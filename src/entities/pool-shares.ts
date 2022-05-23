import { Address } from '@graphprotocol/graph-ts/index';
import { BigDecimal, Bytes } from '@graphprotocol/graph-ts';
import { getExistingToken } from './token';
import { PoolShares } from '../types/schema';
import { getOrCreateUser } from './user';

export function getOrCreatePoolShares(poolId: Bytes, userAddress: Address, tokenAddress: Address): PoolShares {
  const id = poolId.concat(userAddress).concat(tokenAddress);
  let poolShares = PoolShares.load(id);
  if (poolShares == null) {
    const token = getExistingToken(tokenAddress);
    const user = getOrCreateUser(userAddress);
    poolShares = new PoolShares(id);
    poolShares.pool = poolId;
    poolShares.poolId = poolId;
    poolShares.token = token.id;
    poolShares.tokenAddress = tokenAddress;
    poolShares.user = user.id;
    poolShares.userAddress = userAddress;
    poolShares.balance = BigDecimal.zero();
    poolShares.pricePerShare = BigDecimal.zero();
    poolShares.save();
  }

  return poolShares;
}
