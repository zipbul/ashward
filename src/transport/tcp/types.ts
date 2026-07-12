import type { ProbeSocket } from './interfaces';

/** Opens a connection to the endpoint. Injectable so tests can drive a fake socket. */
export type Connector = (endpoint: { host: string; port: number }) => ProbeSocket;
