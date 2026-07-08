export interface RawOrigin {
  readonly port: number;
  close(): Promise<void>;
}
