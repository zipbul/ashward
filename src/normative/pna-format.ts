/** PNA §3.4.2 `Private-Network-Access-ID`: six colon-separated hex bytes, e.g. `01:23:45:67:89:0A`. */
const PNA_ID = /^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$/;
/** PNA §3.4.2 `Private-Network-Access-Name`: `/^[a-z0-9_\-.]+$/`. */
const PNA_NAME = /^[a-z0-9_.-]+$/;

export function isPnaId(value: string): boolean {
  return PNA_ID.test(value);
}

/** The Name additionally must be ≤248 UTF-8 code units; the regex is ASCII-only, so bytes === length. */
export function isPnaName(value: string): boolean {
  return PNA_NAME.test(value) && value.length <= 248;
}
