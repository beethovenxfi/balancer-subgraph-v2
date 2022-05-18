import { DailyVaultMetric, GlobalVaultMetric } from '../types/schema';
import { Bytes } from '@graphprotocol/graph-ts/index';
import { BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { vaultId } from './vault';

export function getOrCreateGlobalVaultMetric(block: ethereum.Block): GlobalVaultMetric {
  const id = Bytes.fromI32(2);
  let globalVaultMetric = GlobalVaultMetric.load(id);
  if (globalVaultMetric == null) {
    globalVaultMetric = new GlobalVaultMetric(id);
    globalVaultMetric.vault = Bytes.fromI32(2);
    globalVaultMetric.swapCount = BigInt.zero();
    globalVaultMetric.totalSwapVolume = BigDecimal.zero();
    globalVaultMetric.totalSwapFee = BigDecimal.zero();
    globalVaultMetric.totalLiquidity = BigDecimal.zero();
    globalVaultMetric.startTime = block.timestamp.toI32();
    globalVaultMetric.save();
  }
  return globalVaultMetric;
}

export function getOrCreateDailyVaultMetric(block: ethereum.Block): DailyVaultMetric {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = vaultId.concatI32(dayId);
  let dailyVaultMetric = DailyVaultMetric.load(id);

  if (dailyVaultMetric === null) {
    dailyVaultMetric = new DailyVaultMetric(id);
    dailyVaultMetric.day = dayId;
    dailyVaultMetric.startTime = dayId * 86400;
    dailyVaultMetric.vault = vaultId;
    dailyVaultMetric.totalSwapVolume = BigDecimal.zero();
    dailyVaultMetric.swapVolumeChange24h = BigDecimal.zero();
    dailyVaultMetric.swapVolume24h = BigDecimal.zero();
    dailyVaultMetric.totalSwapFee = BigDecimal.zero();
    dailyVaultMetric.swapFeeChange24h = BigDecimal.zero();
    dailyVaultMetric.swapFee24h = BigDecimal.zero();
    dailyVaultMetric.totalLiquidity = BigDecimal.zero();
    dailyVaultMetric.liquidityChange24h = BigDecimal.zero();
    dailyVaultMetric.swapCount24h = BigInt.zero();
    dailyVaultMetric.swapCountChange24h = BigInt.zero();
    dailyVaultMetric.totalSwapCount = BigInt.zero();
    dailyVaultMetric.save();
  }
  return dailyVaultMetric;
}

export function getDailyVaultMetricAtDay(day: i32): DailyVaultMetric | null {
  return DailyVaultMetric.load(vaultId.concatI32(day));
}
