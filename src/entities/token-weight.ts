import { BigDecimal, Bytes } from '@graphprotocol/graph-ts';
import { Address } from '@graphprotocol/graph-ts/index';
import { TokenWeight } from '../types/schema';

export function getOrCreateTokenWeight(poolId: Bytes, tokenAddress: Address): TokenWeight {
  const id = poolId.concat(tokenAddress);
  let tokenWeight = TokenWeight.load(id);

  if (tokenWeight == null) {
    tokenWeight = new TokenWeight(id);
    tokenWeight.weight = BigDecimal.zero();
    tokenWeight.token = tokenAddress;
    tokenWeight.tokenAddress = tokenAddress;
    tokenWeight.pool = poolId;
    tokenWeight.poolId = poolId;
    tokenWeight.save();
  }
  return tokenWeight;
}

export function loadExistingTokenWeight(poolId: Bytes, tokenAddress: Address): TokenWeight {
  return TokenWeight.load(poolId.concat(tokenAddress)) as TokenWeight;
}
