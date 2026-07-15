/**
 * RFC 1950 §2.2 zlib header: `CMF` (low nibble `CM=8` for deflate) followed by `FLG`, with the
 * 16-bit big-endian pair `(CMF<<8)|FLG` a multiple of 31 (the "check bits"), and FDICT (FLG bit 5)
 * clear — a preset dictionary changes what follows the header, which this predicate does not parse.
 */
export function isZlibWrapped(bytes: Uint8Array): boolean {
  if (bytes.length < 2) {
    return false;
  }

  const cmf = bytes[0] ?? 0;
  const flg = bytes[1] ?? 0;

  if ((cmf & 0x0f) !== 8) {
    return false;
  }

  // RFC 1950 §2.2: CINFO (the CMF high nibble) is only defined up to 7 for CM=8 (deflate) — a
  // window size beyond 32K is not a valid deflate wrapper.
  if (cmf >> 4 > 7) {
    return false;
  }

  if ((cmf * 256 + flg) % 31 !== 0) {
    return false;
  }

  return (flg & 0x20) === 0;
}
