import { BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { GlobalPoolMetric } from '../types/schema';

export function getOrCreateGlobalPoolMetrics(poolId: Bytes, block: ethereum.Block): GlobalPoolMetric {
  let globalPoolMetrics = GlobalPoolMetric.load(poolId);
  if (globalPoolMetrics == null) {
    globalPoolMetrics = new GlobalPoolMetric(poolId);
    globalPoolMetrics.pool = poolId;
    globalPoolMetrics.poolId = poolId;
    globalPoolMetrics.startTime = block.timestamp.toI32();
    globalPoolMetrics.totalSwapVolume = BigDecimal.zero();
    globalPoolMetrics.totalLiquidity = BigDecimal.zero();
    globalPoolMetrics.totalShares = BigDecimal.zero();
    globalPoolMetrics.totalTransactions = BigInt.zero();
    globalPoolMetrics.swapsCount = BigInt.zero();
    globalPoolMetrics.totalSwapFee = BigDecimal.zero();
    globalPoolMetrics.holdersCount = BigInt.zero();
    globalPoolMetrics.save();
  }
  return globalPoolMetrics;
}
