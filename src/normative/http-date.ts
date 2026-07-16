/** RFC 9110 §5.6.7 HTTP-date formatting AND strict parsing. Formatting builds conditional-request
 *  probe values (`If-Modified-Since`/`If-Unmodified-Since`) in each of the three recipient-accepted
 *  formats a rule's `build` step needs, and lets test fixtures construct "the same instant" in every
 *  format. `parseHttpDate` is the STRICT counterpart a rule's `gate` step uses to validate a
 *  discovered `Last-Modified` before trusting it as a validator — grammar-exact, never the loose
 *  `Date` constructor (which also accepts ISO 8601 and countless other non-HTTP-date shapes). */

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

const IMF_FIXDATE_RE =
  /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

const RFC850_DATE_RE =
  /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/;

// asctime-date's day-of-month is EITHER two digits OR a single digit preceded by an extra space
// (never zero-padded) — `date3 = month SP (2DIGIT / (SP 1DIGIT))` (RFC 9110 §5.6.7).
const ASCTIME_DATE_RE =
  /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( \d|\d{2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/;

function monthIndexOf(abbr: string): number | null {
  const index = MONTH_ABBR.indexOf(abbr);
  return index === -1 ? null : index;
}

interface DateComponents {
  readonly year: number;
  readonly monthIndex: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** Build the epoch instant for `components`, or `null` when any field is out of range (hour
 *  0-23, minute/second 0-59) or the combination is not a real calendar date (e.g. 31 February) —
 *  `Date.UTC` silently normalizes overflow (rolling 31 Feb into 3 Mar), so the round-tripped
 *  components are compared back against the input to catch that. */
function componentsToEpoch(components: DateComponents): number | null {
  const { year, monthIndex, day, hour, minute, second } = components;
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const ms = Date.UTC(year, monthIndex, day, hour, minute, second);
  const check = new Date(ms);
  const roundTrips =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === monthIndex &&
    check.getUTCDate() === day &&
    check.getUTCHours() === hour &&
    check.getUTCMinutes() === minute &&
    check.getUTCSeconds() === second;
  return roundTrips ? ms : null;
}

function parseImfFixdate(value: string): number | null {
  const match = IMF_FIXDATE_RE.exec(value);
  if (match === null) {
    return null;
  }
  const [, day, month, year, hour, minute, second] = match;
  const monthIndex = monthIndexOf(month ?? '');
  if (monthIndex === null) {
    return null;
  }
  return componentsToEpoch({
    year: Number(year),
    monthIndex,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  });
}

function parseRfc850Date(value: string, now: Date): number | null {
  const match = RFC850_DATE_RE.exec(value);
  if (match === null) {
    return null;
  }
  const [, day, month, twoDigitYear, hour, minute, second] = match;
  const monthIndex = monthIndexOf(month ?? '');
  if (monthIndex === null) {
    return null;
  }
  const dayNum = Number(day);
  const hourNum = Number(hour);
  const minuteNum = Number(minute);
  const secondNum = Number(second);
  const year = resolveRfc850Year(Number(twoDigitYear), monthIndex, dayNum, hourNum, minuteNum, secondNum, now);
  return componentsToEpoch({ year, monthIndex, day: dayNum, hour: hourNum, minute: minuteNum, second: secondNum });
}

function parseAsctimeDate(value: string): number | null {
  const match = ASCTIME_DATE_RE.exec(value);
  if (match === null) {
    return null;
  }
  const [, month, day, hour, minute, second, year] = match;
  const monthIndex = monthIndexOf(month ?? '');
  if (monthIndex === null) {
    return null;
  }
  return componentsToEpoch({
    year: Number(year),
    monthIndex,
    day: Number((day ?? '').trim()),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  });
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

/**
 * RFC 9110 §5.6.7's own 2-digit-year disambiguation rule: a recipient resolves a `twoDigitYear`
 * (paired with the rest of an rfc850-date's components) to whichever candidate century keeps the
 * resulting INSTANT from reading as more than 50 years past `now` — comparing the full instant
 * (year, month, day, and time-of-day), never the year alone. A year-only comparison
 * (`naiveYear > now.getUTCFullYear() + 50`) is insufficiently precise: when the naive year lands
 * exactly on `now`'s year + 50, whether the candidate is genuinely more than 50 years out still
 * depends on where its month/day falls relative to `now`'s within that year.
 */
export function resolveRfc850Year(
  twoDigitYear: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  now: Date,
): number {
  const century = Math.floor(now.getUTCFullYear() / 100) * 100;
  const naiveYear = century + twoDigitYear;
  const candidateMs = Date.UTC(naiveYear, monthIndex, day, hour, minute, second);
  const cutoffMs = Date.UTC(
    now.getUTCFullYear() + 50,
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
  );
  return candidateMs > cutoffMs ? naiveYear - 100 : naiveYear;
}

/**
 * A STRICT RFC 9110 §5.6.7 HTTP-date parser: accepts exactly one of the three grammar-defined
 * forms (IMF-fixdate, rfc850-date, asctime-date) — never a loosely-parsed ISO 8601 string or any
 * other shape the `Date` constructor happens to accept. Returns the parsed instant as epoch
 * milliseconds, or `null` when `value` is not grammar-valid (including a syntactically-plausible
 * but calendrically-impossible date, e.g. 31 February, or an out-of-range time-of-day). `now`
 * resolves an rfc850-date's 2-digit year per §5.6.7's own 50-year rule (see `resolveRfc850Year`)
 * and defaults to the real wall clock.
 */
export function parseHttpDate(value: string, now: Date = new Date()): number | null {
  return parseImfFixdate(value) ?? parseRfc850Date(value, now) ?? parseAsctimeDate(value);
}
