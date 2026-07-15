/** RFC 9110 §5.6.7 HTTP-date formatting — used to build conditional-request probe values (`If-
 *  Modified-Since`/`If-Unmodified-Since`) in each of the three recipient-accepted formats a rule's
 *  `build` step needs, and by test fixtures constructing "the same instant" in every format. This
 *  module only FORMATS a `Date` (a rule never needs to parse an arbitrary origin-sent date to build
 *  its own probe); it never claims to be a general HTTP-date parser. */

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function dayAbbr(date: Date): string {
  return DAY_ABBR[date.getUTCDay()] ?? '';
}

function dayFull(date: Date): string {
  return DAY_FULL[date.getUTCDay()] ?? '';
}

function monthAbbr(date: Date): string {
  return MONTH_ABBR[date.getUTCMonth()] ?? '';
}

function clock(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

/** RFC 9110 §5.6.7 IMF-fixdate: `Sun, 06 Nov 1994 08:49:37 GMT`. */
export function formatImfFixdate(date: Date): string {
  return `${dayAbbr(date)}, ${pad2(date.getUTCDate())} ${monthAbbr(date)} ${date.getUTCFullYear()} ${clock(date)} GMT`;
}

/** RFC 9110 §5.6.7 rfc850-date: `Sunday, 06-Nov-94 08:49:37 GMT` — a full day-name, and a 2-digit
 *  year the reader must apply the §5.6.7 50-year rule to (never flipped here; the caller picks a
 *  fixture year the rule does not apply to). */
export function formatRfc850(date: Date): string {
  const yy = pad2(date.getUTCFullYear() % 100);
  return `${dayFull(date)}, ${pad2(date.getUTCDate())}-${monthAbbr(date)}-${yy} ${clock(date)} GMT`;
}

/** RFC 9110 §5.6.7 asctime-date: `Sun Nov  6 08:49:37 1994` — the day-of-month is SPACE-padded
 *  (never zero-padded) when it is a single digit. */
export function formatAsctime(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, ' ');
  return `${dayAbbr(date)} ${monthAbbr(date)} ${day} ${clock(date)} ${date.getUTCFullYear()}`;
}

/** A new `Date` offset by `days` (may be negative) from `date`, at the same time-of-day. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
