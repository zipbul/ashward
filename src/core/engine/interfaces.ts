export interface Target {
  readonly host: string;
  readonly port: number;
  /** The request-target (path + query) from the caller's URL. Rules that craft requests aim them
   *  here and set `Host` to `host`, so path-scoped / vhost-routed origins are probed at the real
   *  resource rather than a hardcoded `/`. Exposed to rules via RuleContext. */
  readonly path: string;
  readonly timeoutMs: number;
}
