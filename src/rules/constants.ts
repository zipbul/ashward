import { duplicateContentLength } from './ietf/http-messaging/framing/duplicate-content-length';
import { clTeConflict } from './ietf/http-messaging/framing/cl-te-conflict';
import type { RuleDef } from '../core/contract/interfaces';

/** The built-in rules run by default. Grows as packs land; today: HTTP/1.1 framing. */
export const BUILTIN_RULES: readonly RuleDef[] = [duplicateContentLength, clTeConflict];
