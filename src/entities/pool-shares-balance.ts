import { PoolSharesBalance, PoolTokenBalance } from '../types/schema';
import { Address } from '@graphprotocol/graph-ts/index';
import { BigDecimal, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { getToken } from './token';

export function getPoolSharesBalance(poolId: Bytes, tokenAddress: Address, block: ethereum.Block): PoolTokenBalance {
  const id = poolId.concat(tokenAddress);
  let poolSharesBalance = PoolSharesBalance.load(id);
  if (poolSharesBalance === null) {
    const token = getToken(tokenAddress);
    poolSharesBalance = new PoolSharesBalance(id);
    poolSharesBalance.pool = poolId;
    poolSharesBalance.poolId = poolId;
    poolSharesBalance.token = token.id;
    poolSharesBalance.tokenAddress = tokenAddress;
    poolSharesBalance.balance = BigDecimal.zero();
  }
  poolSharesBalance.block = block.number;
  poolSharesBalance.timestamp = block.timestamp;

  poolSharesBalance.save();
  return poolSharesBalance;
}
