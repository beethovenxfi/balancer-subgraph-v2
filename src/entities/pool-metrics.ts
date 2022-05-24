import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { DailyPoolMetric, DailyPoolToken, LifetimePoolMetric } from '../types/schema';

export function getOrCreateLifetimePoolMetrics(poolId: Bytes, block: ethereum.Block): LifetimePoolMetric {
  let lifetimePoolMetric = LifetimePoolMetric.load(poolId);
  if (lifetimePoolMetric == null) {
    lifetimePoolMetric = new LifetimePoolMetric(poolId);
    lifetimePoolMetric.pool = poolId;
    lifetimePoolMetric.poolId = poolId;
    lifetimePoolMetric.startTime = block.timestamp.toI32();
    lifetimePoolMetric.totalSwapVolume = BigDecimal.zero();
    lifetimePoolMetric.totalLiquidity = BigDecimal.zero();
    lifetimePoolMetric.dilutedLiquidity = BigDecimal.zero();
    lifetimePoolMetric.totalShares = BigDecimal.zero();
    lifetimePoolMetric.swapCount = BigInt.zero();
    lifetimePoolMetric.totalSwapFee = BigDecimal.zero();
    lifetimePoolMetric.holdersCount = BigInt.zero();
    lifetimePoolMetric.save();
  }
  return lifetimePoolMetric;
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
    dailyPoolMetric.totalShares = BigDecimal.zero();
    dailyPoolMetric.swapVolume24h = BigDecimal.zero();
    dailyPoolMetric.swapVolumeChange24h = BigDecimal.zero();
    dailyPoolMetric.totalSwapVolume = BigDecimal.zero();
    dailyPoolMetric.swapFee24h = BigDecimal.zero();
    dailyPoolMetric.swapFeeChange24h = BigDecimal.zero();
    dailyPoolMetric.totalSwapFee = BigDecimal.zero();
    dailyPoolMetric.totalLiquidity = BigDecimal.zero();
    dailyPoolMetric.dilutedLiquidity = BigDecimal.zero();
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

export function getOrCreateDailyPoolToken(poolId: Bytes, tokenAddress: Address, block: ethereum.Block): DailyPoolToken {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = poolId.concat(tokenAddress).concatI32(dayId);
  let dailyPoolToken = DailyPoolToken.load(id);
  if (dailyPoolToken === null) {
    dailyPoolToken = new DailyPoolToken(id);
    dailyPoolToken.pool = poolId;
    dailyPoolToken.poolId = poolId;
    dailyPoolToken.day = dayId;
    dailyPoolToken.startTime = dayId * 86400;
    dailyPoolToken.token = tokenAddress;
    dailyPoolToken.tokenAddress = tokenAddress;
    dailyPoolToken.totalBalance = BigDecimal.zero();
    dailyPoolToken.balanceChange24h = BigDecimal.zero();
    dailyPoolToken.save();
  }
  return dailyPoolToken;
}
