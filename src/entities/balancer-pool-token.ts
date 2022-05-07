import { BalancerPoolToken } from '../types/schema';
import { Bytes } from '@graphprotocol/graph-ts';

export function loadBalancerPoolToken(poolId: Bytes, tokenAddres: Bytes): BalancerPoolToken | null {
  return BalancerPoolToken.load(poolId.concat(tokenAddres));
}
