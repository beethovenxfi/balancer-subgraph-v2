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
    globalPoolMetrics.swapCount = BigInt.zero();
    globalPoolMetrics.totalSwapFee = BigDecimal.zero();
    globalPoolMetrics.holdersCount = BigInt.zero();
    globalPoolMetrics.save();
  }
  return globalPoolMetrics;
}

export function getOrCreateDailyPoolMetrics(poolId: Bytes, block: ethereum.Block): DailyPoolMetric {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = poolId.concatI32(dayId);
  let dailyPoolMetric = DailyPoolMetric.load(id);

  if (dailyPoolMetric === null) {
    dailyPoolMetric = new DailyPoolMetric(id);
    dailyPoolMetric.day = dayId;
    dailyPoolMetric.startTime = dayId * 86400;
    dailyPoolMetric.pool = poolId;
    dailyPoolMetric.poolId = poolId;
    dailyPoolMetric.swapVolume24h = BigDecimal.zero();
    dailyPoolMetric.swapVolumeChange24h = BigDecimal.zero();
    dailyPoolMetric.totalSwapVolume = BigDecimal.zero();
    dailyPoolMetric.swapFee24h = BigDecimal.zero();
    dailyPoolMetric.swapFeeChange24h = BigDecimal.zero();
    dailyPoolMetric.totalSwapFee = BigDecimal.zero();
    dailyPoolMetric.totalLiquidity = BigDecimal.zero();
    dailyPoolMetric.liquidityChange24h = BigDecimal.zero();
    dailyPoolMetric.swapCount24h = BigInt.zero();
    dailyPoolMetric.totalSwapCount = BigInt.zero();
    dailyPoolMetric.swapCountChange24h = BigInt.zero();
    dailyPoolMetric.save();
  }
  return dailyPoolMetric;
}

export function getDailyPoolMetricAtDay(poolId: Bytes, day: i32): DailyPoolMetric | null {
  return DailyPoolMetric.load(poolId.concatI32(day));
}
