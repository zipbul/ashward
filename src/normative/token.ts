/** RFC 9110 §5.6.2 `token = 1*tchar`. Method names and field names are both tokens. */
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function isToken(value: string): boolean {
  return TOKEN.test(value);
}
