/** A reserved `.invalid` origin (RFC 2606) — no origin under test can legitimately be configured
 *  to trust it, so any grant to it is a grant to an arbitrary attacker's origin. The probe's
 *  forged Origin. */
export const PROBE_ORIGIN = 'https://ashward.invalid';

/** A second forged origin. Two probes differing only in Origin reveal whether the server's answer
 *  depends on the request's origin (which is what makes Vary required). */
export const ALT_PROBE_ORIGIN = 'https://alt.ashward.invalid';
