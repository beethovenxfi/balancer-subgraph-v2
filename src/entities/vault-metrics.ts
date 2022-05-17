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
    globalVaultMetric.totalSwapCount = BigInt.zero();
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
    dailyVaultMetric.startTime = dayId;
    dailyVaultMetric.vault = vaultId;
    dailyVaultMetric.totalSwapVolume = BigDecimal.zero();
    dailyVaultMetric.totalSwapFee = BigDecimal.zero();
    dailyVaultMetric.addedLiquidity = BigDecimal.zero();
    dailyVaultMetric.removedLiquidity = BigDecimal.zero();
    dailyVaultMetric.totalTransactions = BigInt.zero();
    dailyVaultMetric.swapsCount = BigInt.zero();
    dailyVaultMetric.save();
  }
  return dailyVaultMetric;
}
