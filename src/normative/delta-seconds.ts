/** RFC 9111 §1.2.2 `delta-seconds = 1*DIGIT`. No sign, no fraction, no units. */
const DELTA_SECONDS = /^\d+$/;

export function isDeltaSeconds(value: string): boolean {
  return DELTA_SECONDS.test(value);
}
