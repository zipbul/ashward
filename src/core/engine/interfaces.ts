export interface Target {
  readonly host: string;
  readonly port: number;
  /** The request-target (path + query) from the caller's URL. Rules that craft requests aim them
   *  here and set `Host` to `host`, so path-scoped / vhost-routed CORS is probed at the real
   *  resource rather than a hardcoded `/`. */
  readonly path: string;
  readonly timeoutMs: number;
}
