/**
 * RFC 8878 §3.1.1 zstd frame parsing: enough of the Frame_Header to recover the declared window
 * size and the Frame_Header_Descriptor's spec-reserved bits, without decompressing anything.
 * Both entry points share {@link locateStandardFrame} (skip leading Skippable_Frames, §3.1.2) and
 * {@link parseFrameHeader} (walk Window_Descriptor / Dictionary_ID / Frame_Content_Size in their
 * on-wire order, §3.1.1.1).
 *
 * RFC 8878 §3.1 permits concatenating multiple frames in one stream, and RFC 9659 §3's 8 MiB
 * window cap applies PER frame — so {@link zstdWindowSizes} and {@link zstdAllReservedBitsZero}
 * walk every standard frame in the buffer (skipping any interleaved Skippable_Frames), not just
 * the first. Walking past a frame's header requires knowing where its block data ends; that is
 * recovered from each Block_Header's own size field (RFC 8878 §3.1.1.2) — never by decompressing
 * the blocks themselves.
 */

const STANDARD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd] as const;
const DICTIONARY_ID_SIZES = [0, 1, 2, 4] as const;

interface FrameHeader {
  readonly singleSegment: boolean;
  readonly windowDescriptor: number | null;
  readonly frameContentSize: number | null;
  readonly unusedBit: number;
  readonly reservedBit: number;
  readonly contentChecksumFlag: boolean;
  /** Offset of the first byte after the Frame_Header — where Block data begins. */
  readonly headerEnd: number;
}

function readUintLe(bytes: Uint8Array, pos: number, size: number): number {
  let value = 0;
  for (let i = size - 1; i >= 0; i--) {
    value = value * 256 + (bytes[pos + i] ?? 0);
  }
  return value;
}

/** Skips leading Skippable_Frames (magic `0x184D2A50`–`0x184D2A5F`) starting at `start` to find
 *  the next standard frame's magic-number offset. */
function locateStandardFrame(bytes: Uint8Array, start = 0): number | null {
  let offset = start;

  for (;;) {
    if (offset + 4 > bytes.length) {
      return null;
    }

    const b0 = bytes[offset] ?? 0;
    const b1 = bytes[offset + 1] ?? 0;
    const b2 = bytes[offset + 2] ?? 0;
    const b3 = bytes[offset + 3] ?? 0;

    if (b0 === STANDARD_MAGIC[0] && b1 === STANDARD_MAGIC[1] && b2 === STANDARD_MAGIC[2] && b3 === STANDARD_MAGIC[3]) {
      return offset;
    }

    const isSkippable = b0 >= 0x50 && b0 <= 0x5f && b1 === 0x2a && b2 === 0x4d && b3 === 0x18;

    if (!isSkippable) {
      return null;
    }

    if (offset + 8 > bytes.length) {
      return null;
    }

    const frameSize = readUintLe(bytes, offset + 4, 4);

    offset += 8 + frameSize;
  }
}

/** Parses the Frame_Header at `frameOffset` (the standard frame's magic-number offset). */
function parseFrameHeader(bytes: Uint8Array, frameOffset: number): FrameHeader | null {
  const descriptorOffset = frameOffset + 4;

  if (descriptorOffset >= bytes.length) {
    return null;
  }

  const descriptor = bytes[descriptorOffset] ?? 0;
  const frameContentSizeFlag = (descriptor >> 6) & 0x3;
  const singleSegment = ((descriptor >> 5) & 0x1) === 1;
  const unusedBit = (descriptor >> 4) & 0x1;
  const reservedBit = (descriptor >> 3) & 0x1;
  const contentChecksumFlag = ((descriptor >> 2) & 0x1) === 1;
  const dictionaryIdFlag = descriptor & 0x3;

  let pos = descriptorOffset + 1;
  let windowDescriptor: number | null = null;

  if (!singleSegment) {
    if (pos >= bytes.length) {
      return null;
    }
    windowDescriptor = bytes[pos] ?? 0;
    pos += 1;
  }

  const dictionaryIdSize = DICTIONARY_ID_SIZES[dictionaryIdFlag] ?? 0;

  if (pos + dictionaryIdSize > bytes.length) {
    return null;
  }
  pos += dictionaryIdSize;

  const frameContentSizeSize =
    frameContentSizeFlag === 0 ? (singleSegment ? 1 : 0) : frameContentSizeFlag === 1 ? 2 : frameContentSizeFlag === 2 ? 4 : 8;

  let frameContentSize: number | null = null;

  if (frameContentSizeSize > 0) {
    if (pos + frameContentSizeSize > bytes.length) {
      return null;
    }
    frameContentSize = readUintLe(bytes, pos, frameContentSizeSize);
    if (frameContentSizeFlag === 1) {
      frameContentSize += 256;
    }
    pos += frameContentSizeSize;
  }

  return { singleSegment, windowDescriptor, frameContentSize, unusedBit, reservedBit, contentChecksumFlag, headerEnd: pos };
}

/**
 * RFC 8878 §3.1.1.1.2 window size: the Frame_Content_Size when Single_Segment_flag is set, else
 * decoded from the Window_Descriptor byte (`windowBase = 2^(10+exponent)`,
 * `windowAdd = (windowBase/8) * mantissa`).
 */
function windowSizeOf(header: FrameHeader): number | null {
  if (header.singleSegment) {
    return header.frameContentSize;
  }

  if (header.windowDescriptor === null) {
    return null;
  }

  const exponent = (header.windowDescriptor >> 3) & 0x1f;
  const mantissa = header.windowDescriptor & 0x7;
  const windowBase = 2 ** (10 + exponent);
  const windowAdd = (windowBase / 8) * mantissa;

  return windowBase + windowAdd;
}

/**
 * RFC 8878 §3.1.1.2 Block_Header: a 3-byte little-endian field — Last_Block (bit 0), Block_Type
 * (bits 1-2), Block_Size (bits 3-23, meaning depends on Block_Type). Walks blocks from `headerEnd`
 * (using each block's own declared size — never decompressing) to find where the frame's content
 * ends, then accounts for the optional trailing 4-byte Content_Checksum. Returns the offset of the
 * byte just past the frame, or null when a block is malformed/truncated (RLE's Block_Size is a
 * decompressed run length, not a wire byte count — the wire representation is always 1 byte).
 */
function frameEnd(bytes: Uint8Array, header: FrameHeader): number | null {
  let pos = header.headerEnd;

  for (;;) {
    if (pos + 3 > bytes.length) {
      return null;
    }
    const blockHeader = readUintLe(bytes, pos, 3);
    const lastBlock = (blockHeader & 0x1) === 1;
    const blockType = (blockHeader >> 1) & 0x3;
    const blockSize = blockHeader >> 3;
    pos += 3;

    if (blockType === 3) {
      return null; // Reserved block type — not a parseable stream.
    }

    const wireSize = blockType === 1 ? 1 : blockSize; // RLE_Block: 1 literal byte on the wire.
    if (pos + wireSize > bytes.length) {
      return null;
    }
    pos += wireSize;

    if (lastBlock) {
      break;
    }
  }

  if (header.contentChecksumFlag) {
    if (pos + 4 > bytes.length) {
      return null;
    }
    pos += 4;
  }

  return pos;
}

/** Walks every standard frame in `bytes`, skipping interleaved Skippable_Frames, stopping as soon
 *  as a frame's header or block data cannot be parsed (a truncated/malformed tail is simply not
 *  reported, matching the single-frame helpers' "unparseable → not reported" discipline). */
function parseAllFrames(bytes: Uint8Array): readonly FrameHeader[] {
  const headers: FrameHeader[] = [];
  let offset = 0;

  for (;;) {
    const frameOffset = locateStandardFrame(bytes, offset);
    if (frameOffset === null) {
      return headers;
    }

    const header = parseFrameHeader(bytes, frameOffset);
    if (header === null) {
      return headers;
    }
    headers.push(header);

    const end = frameEnd(bytes, header);
    if (end === null) {
      return headers;
    }
    offset = end;
  }
}

/**
 * RFC 8878 §3.1.1.1.2 window size of the FIRST standard frame in `bytes` — the Frame_Content_Size
 * when Single_Segment_flag is set, else decoded from the Window_Descriptor byte
 * (`windowBase = 2^(10+exponent)`, `windowAdd = (windowBase/8) * mantissa`). `null` if `bytes` is
 * not a parseable zstd frame. For a multi-frame stream, prefer {@link zstdWindowSizes}.
 */
export function zstdWindowSize(bytes: Uint8Array): number | null {
  const frameOffset = locateStandardFrame(bytes);

  if (frameOffset === null) {
    return null;
  }

  const header = parseFrameHeader(bytes, frameOffset);

  if (header === null) {
    return null;
  }

  return windowSizeOf(header);
}

/**
 * True iff the FIRST standard frame's Frame_Header_Descriptor Unused bit (bit 4) and Reserved bit
 * (bit 3) are both zero (RFC 8878 §3.1.1.1.1: "Reserved_bit … must be set to zero"). `null` if
 * `bytes` is not a parseable zstd frame. For a multi-frame stream, prefer
 * {@link zstdAllReservedBitsZero}.
 */
export function zstdReservedBitsZero(bytes: Uint8Array): boolean | null {
  const frameOffset = locateStandardFrame(bytes);

  if (frameOffset === null) {
    return null;
  }

  const header = parseFrameHeader(bytes, frameOffset);

  if (header === null) {
    return null;
  }

  return header.unusedBit === 0 && header.reservedBit === 0;
}

/**
 * The window size (RFC 8878 §3.1.1.1.2) of EVERY standard frame in `bytes`, in stream order,
 * skipping any interleaved Skippable_Frames (RFC 9659 §3's 8 MiB HTTP window cap applies per
 * frame, so a later frame exceeding it must not be hidden behind a conformant first frame).
 * Empty when `bytes` does not begin with a parseable zstd frame at all.
 */
export function zstdWindowSizes(bytes: Uint8Array): number[] {
  return parseAllFrames(bytes)
    .map(windowSizeOf)
    .filter((size): size is number => size !== null);
}

/**
 * True iff EVERY standard frame in `bytes` has its Frame_Header_Descriptor Unused and Reserved
 * bits clear. `null` if `bytes` does not begin with a parseable zstd frame at all.
 */
export function zstdAllReservedBitsZero(bytes: Uint8Array): boolean | null {
  const headers = parseAllFrames(bytes);

  if (headers.length === 0) {
    return null;
  }

  return headers.every(header => header.unusedBit === 0 && header.reservedBit === 0);
}
