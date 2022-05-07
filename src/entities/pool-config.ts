import { BigDecimal, Bytes } from '@graphprotocol/graph-ts';
import { PoolConfig } from '../types/schema';

export function getPoolConfig(poolId: Bytes): PoolConfig {
  let poolConfig = PoolConfig.load(poolId);

  if (poolConfig == null) {
    poolConfig = new PoolConfig(poolId);
    poolConfig.swapFee = BigDecimal.zero();
    poolConfig.swapEnabled = true;
    poolConfig.save();
  }
  return poolConfig;
}
