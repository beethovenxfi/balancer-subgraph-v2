import { Address } from '@graphprotocol/graph-ts/index';
import { BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { createTokenIfNotExist } from './token';
import { PoolToken } from '../types/schema';

export function createPoolToken(poolId: Bytes, tokenAddress: Address): PoolToken {
  const id = poolId.concat(tokenAddress);
  const token = createTokenIfNotExist(tokenAddress, false);
  const poolToken = new PoolToken(id);
  poolToken.pool = poolId;
  poolToken.poolId = poolId;
  poolToken.token = token.id;
  poolToken.tokenAddress = tokenAddress;
  poolToken.balance = BigDecimal.zero();
  poolToken.swapCount = BigInt.zero();
  poolToken.save();

  return poolToken;
}

export function loadExistingPoolToken(poolId: Bytes, tokenAddress: Address): PoolToken {
  const id = poolId.concat(tokenAddress);
  return PoolToken.load(id) as PoolToken;
}
