import type { AddressInfo } from 'node:net';

/** Extract the bound TCP port, or throw if the socket has no numeric address. */
export function portFromAddress(address: AddressInfo | string | null): number {
  if (address === null || typeof address === 'string') {
    throw new Error('ashward testkit: expected a bound TCP address');
  }
  return address.port;
}
