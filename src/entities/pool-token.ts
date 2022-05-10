import { Address } from '@graphprotocol/graph-ts/index';
import { BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { getOrCreateToken } from './token';
import { PoolToken } from '../types/schema';

export function getPoolToken(poolId: Bytes, tokenAddress: Address): PoolToken {
  const id = poolId.concat(tokenAddress);
  let poolToken = PoolToken.load(id);
  if (poolToken === null) {
    const token = getOrCreateToken(tokenAddress);
    poolToken = new PoolToken(id);
    poolToken.pool = poolId;
    poolToken.poolId = poolId;
    poolToken.token = token.id;
    poolToken.tokenAddress = tokenAddress;
    poolToken.balance = BigDecimal.zero();
    poolToken.priceUsd = BigDecimal.zero();
    poolToken.swapCount = BigInt.zero();
    poolToken.save();
  }

  return poolToken;
}
