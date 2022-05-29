import { BigDecimal, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { DailyFarmMetric, Farm, LifetimeFarmMetric } from '../types/schema';

export function getExistingFarm(farmId: Bytes): Farm {
  return Farm.load(farmId) as Farm;
}

export function getExistingLifetimeFarmMetrics(farmId: Bytes): LifetimeFarmMetric {
  return LifetimeFarmMetric.load(farmId) as LifetimeFarmMetric;
}

export function getOrCreateDailyFarmMetric(farmId: Bytes, block: ethereum.Block): DailyFarmMetric {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = farmId.concatI32(dayId);

  let dailyFarmMetric = DailyFarmMetric.load(id);
  if (dailyFarmMetric === null) {
    dailyFarmMetric = new DailyFarmMetric(id);
    dailyFarmMetric.startTime = dayId * 86400;
    dailyFarmMetric.day = dayId;
    dailyFarmMetric.totalLiquidity = BigDecimal.zero();
    dailyFarmMetric.liqudityChange24h = BigDecimal.zero();
    dailyFarmMetric.farm = farmId;
    dailyFarmMetric.save();
  }
  return dailyFarmMetric;
}
