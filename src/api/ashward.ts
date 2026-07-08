import { runRules } from '../core/engine/run';
import { BUILTIN_RULES } from '../rules/constants';
import { resolveTarget } from './resolve-target';
import type { Report } from '../core/report/interfaces';

/**
 * Public entry: point it at a running server and get back a Report to inspect or assert on.
 * A plain async function — works identically under any test runner and outside one.
 */
export function ashward(url: string): Promise<Report> {
  return runRules(resolveTarget(url), BUILTIN_RULES);
}
