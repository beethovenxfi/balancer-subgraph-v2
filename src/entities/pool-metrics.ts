import { BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { DailyPoolMetric, GlobalPoolMetric } from '../types/schema';

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

export function getDailyPoolMetric(poolId: Bytes, block: ethereum.Block): DailyPoolMetric {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = poolId.concatI32(dayId);
  let dailyPoolMetric = DailyPoolMetric.load(id);

  if (dailyPoolMetric === null) {
    dailyPoolMetric = new DailyPoolMetric(id);
    dailyPoolMetric.startTime = dayId;
    dailyPoolMetric.pool = poolId;
    dailyPoolMetric.poolId = poolId;
    dailyPoolMetric.totalSwapVolume = BigDecimal.zero();
    dailyPoolMetric.totalSwapFee = BigDecimal.zero();
    dailyPoolMetric.addedLiquidity = BigDecimal.zero();
    dailyPoolMetric.removedLiquidity = BigDecimal.zero();
    dailyPoolMetric.totalTransactions = BigInt.zero();
    dailyPoolMetric.swapsCount = BigInt.zero();
    dailyPoolMetric.save();
  }
  return dailyPoolMetric;
}
