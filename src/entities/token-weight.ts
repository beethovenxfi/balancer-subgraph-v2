import { BigDecimal, Bytes } from '@graphprotocol/graph-ts';
import { Address } from '@graphprotocol/graph-ts/index';
import { TokenWeight } from '../types/schema';

export function getTokenWeight(poolId: Bytes, tokenAddress: Address): TokenWeight {
  const id = poolId.concat(tokenAddress);
  let tokenWeight = TokenWeight.load(id);

  if (tokenWeight == null) {
    tokenWeight = new TokenWeight(id);
    tokenWeight.weight = BigDecimal.zero();
    tokenWeight.token = tokenAddress;
    tokenWeight.poolData = poolId.toHexString();
    tokenWeight.save();
  }
  return tokenWeight;
}
