/**
 * RFC 8878 §3.1.1 zstd frame parsing: enough of the Frame_Header to recover the declared window
 * size and the Frame_Header_Descriptor's spec-reserved bits, without decompressing anything.
 * Both entry points share {@link locateStandardFrame} (skip leading Skippable_Frames, §3.1.2) and
 * {@link parseFrameHeader} (walk Window_Descriptor / Dictionary_ID / Frame_Content_Size in their
 * on-wire order, §3.1.1.1).
 */

const STANDARD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd] as const;
const DICTIONARY_ID_SIZES = [0, 1, 2, 4] as const;

interface FrameHeader {
  readonly singleSegment: boolean;
  readonly windowDescriptor: number | null;
  readonly frameContentSize: number | null;
  readonly unusedBit: number;
  readonly reservedBit: number;
}

function readUintLe(bytes: Uint8Array, pos: number, size: number): number {
  let value = 0;
  for (let i = size - 1; i >= 0; i--) {
    value = value * 256 + (bytes[pos + i] ?? 0);
  }
  return value;
}

/** Skips leading Skippable_Frames (magic `0x184D2A50`–`0x184D2A5F`) to find the first standard frame. */
function locateStandardFrame(bytes: Uint8Array): number | null {
  let offset = 0;

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
  }

  return { singleSegment, windowDescriptor, frameContentSize, unusedBit, reservedBit };
}

/**
 * RFC 8878 §3.1.1.1.2 window size: the Frame_Content_Size when Single_Segment_flag is set, else
 * decoded from the Window_Descriptor byte (`windowBase = 2^(10+exponent)`,
 * `windowAdd = (windowBase/8) * mantissa`). `null` if `bytes` is not a parseable zstd frame.
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
 * True iff the Frame_Header_Descriptor's Unused bit (bit 4) and Reserved bit (bit 3) are both
 * zero (RFC 8878 §3.1.1.1.1: "Reserved_bit … must be set to zero"). `null` if `bytes` is not a
 * parseable zstd frame.
 */
export function zstdReservedBitsZero(bytes: Uint8Array): boolean | null {
  const frameOffset = locateStandardFrame(bytes);

  if (frameOffset === null) {
    return null;
  }

  const descriptorOffset = frameOffset + 4;

  if (descriptorOffset >= bytes.length) {
    return null;
  }

  const descriptor = bytes[descriptorOffset] ?? 0;
  const unusedBit = (descriptor >> 4) & 0x1;
  const reservedBit = (descriptor >> 3) & 0x1;

  return unusedBit === 0 && reservedBit === 0;
}
