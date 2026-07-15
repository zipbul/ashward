/** Test-only zstd (RFC 8878 §3.1.1) frame-header builder — the inverse of `normative/zstd.ts`'s
 *  parser, so R7/R8 specs can construct exact byte fixtures instead of hand-rolling magic numbers. */

const STANDARD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd] as const;

interface ZstdFrameOptions {
  readonly singleSegment: boolean;
  /** Window_Descriptor exponent (bits 3-7 of the byte), only emitted when `!singleSegment`. */
  readonly windowExponent?: number;
  /** Window_Descriptor mantissa (bits 0-2 of the byte), only emitted when `!singleSegment`. */
  readonly windowMantissa?: number;
  /** Frame_Content_Size byte-width: 0 (none unless singleSegment, then 1), 2, 4, or 8. */
  readonly frameContentSizeBytes?: 0 | 2 | 4 | 8;
  readonly frameContentSize?: number;
  readonly dictionaryIdBytes?: 0 | 1 | 2 | 4;
  readonly dictionaryId?: number;
  readonly unusedBit?: 0 | 1;
  readonly reservedBit?: 0 | 1;
  /** When true, append a minimal terminating Block_Header (RFC 8878 §3.1.1.2: Last_Block=1,
   *  Block_Type=Raw_Block, Block_Size=0) so the frame is self-delimiting — required for building
   *  a multi-frame fixture the block-walking multi-frame parser can find the next frame after. */
  readonly terminated?: boolean;
}

function writeUintLe(value: number, size: number): number[] {
  const out: number[] = [];
  let v = value;
  for (let i = 0; i < size; i++) {
    out.push(v & 0xff);
    v = Math.floor(v / 256);
  }
  return out;
}

/** Build one standard zstd frame's bytes (magic + Frame_Header only — no data blocks; the window
 *  predicates never read past the header). */
export function buildZstdFrame(options: ZstdFrameOptions): number[] {
  const dictionaryIdBytes = options.dictionaryIdBytes ?? 0;
  const fcsBytesRaw = options.frameContentSizeBytes ?? 0;
  const fcsFlag = fcsBytesRaw === 0 ? 0 : fcsBytesRaw === 2 ? 1 : fcsBytesRaw === 4 ? 2 : 3;
  const dictionaryIdFlag = dictionaryIdBytes === 0 ? 0 : dictionaryIdBytes === 1 ? 1 : dictionaryIdBytes === 2 ? 2 : 3;

  const descriptor =
    (fcsFlag << 6) |
    ((options.singleSegment ? 1 : 0) << 5) |
    ((options.unusedBit ?? 0) << 4) |
    ((options.reservedBit ?? 0) << 3) |
    dictionaryIdFlag;

  const bytes: number[] = [...STANDARD_MAGIC, descriptor];

  if (!options.singleSegment) {
    const exponent = options.windowExponent ?? 0;
    const mantissa = options.windowMantissa ?? 0;
    bytes.push(((exponent & 0x1f) << 3) | (mantissa & 0x7));
  }

  if (dictionaryIdBytes > 0) {
    bytes.push(...writeUintLe(options.dictionaryId ?? 0, dictionaryIdBytes));
  }

  const actualFcsBytes = fcsBytesRaw === 0 && options.singleSegment ? 1 : fcsBytesRaw;
  if (actualFcsBytes > 0) {
    const raw = fcsFlag === 1 ? (options.frameContentSize ?? 0) - 256 : (options.frameContentSize ?? 0);
    bytes.push(...writeUintLe(raw, actualFcsBytes));
  }

  if (options.terminated === true) {
    // Block_Header (3-byte LE): Last_Block=1, Block_Type=0 (Raw_Block), Block_Size=0.
    bytes.push(0x01, 0x00, 0x00);
  }

  return bytes;
}

/** Build a leading Skippable_Frame (RFC 8878 §3.1.2): magic in `0x184D2A50`-`0x184D2A5F` (LE),
 *  Frame_Size (LE 4B), then that many bytes of arbitrary user data. */
export function buildSkippableFrame(magicLowNibble: number, userDataLength: number): number[] {
  const magic = [magicLowNibble & 0xff, 0x2a, 0x4d, 0x18];
  const size = writeUintLe(userDataLength, 4);
  const data = Array.from({ length: userDataLength }, () => 0);
  return [...magic, ...size, ...data];
}
