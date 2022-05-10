import { GlobalVaultMetric } from '../types/schema';
import { Bytes } from '@graphprotocol/graph-ts/index';
import { BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts';

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
