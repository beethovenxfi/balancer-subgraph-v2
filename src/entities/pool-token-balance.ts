import { PoolTokenBalance } from '../types/schema';
import { Address } from '@graphprotocol/graph-ts/index';
import { BigDecimal, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { getToken } from './token';

export function getPoolTokenBalance(poolId: Bytes, tokenAddress: Address, block: ethereum.Block): PoolTokenBalance {
  const id = poolId.concat(tokenAddress);
  let poolTokenBalance = PoolTokenBalance.load(id);
  if (poolTokenBalance === null) {
    const token = getToken(tokenAddress);
    poolTokenBalance = new PoolTokenBalance(id);
    poolTokenBalance.pool = poolId;
    poolTokenBalance.poolId = poolId;
    poolTokenBalance.token = token.id;
    poolTokenBalance.tokenAddress = tokenAddress;
    poolTokenBalance.balance = BigDecimal.zero();
  }
  poolTokenBalance.block = block.number;
  poolTokenBalance.timestamp = block.timestamp;

  poolTokenBalance.save();
  return poolTokenBalance;
}
