/**
 * RFC 1952 §2.3.1 gzip member header: `ID1=0x1f ID2=0x8b CM=0x08(deflate) FLG MTIME[4] XFL OS`,
 * a FIXED 10-byte fixed header before any optional (FLG-gated) fields. The FLG byte's reserved
 * bits (5,6,7) must be zero; MTIME/XFL/OS may be any value.
 */
export function isWellFormedGzipHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 10) {
    return false;
  }

  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 0x08) {
    return false;
  }

  return ((bytes[3] ?? 0) & 0xe0) === 0;
}
