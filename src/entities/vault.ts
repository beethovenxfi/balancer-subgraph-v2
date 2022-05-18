import { Balancer } from '../types/schema';
import { Bytes, ethereum } from '@graphprotocol/graph-ts';
import { getOrCreateGlobalVaultMetric } from './vault-metrics';

export const vaultId = Bytes.fromI32(2);

export function getOrCreateVault(block: ethereum.Block): Balancer {
  let vault: Balancer | null = Balancer.load(vaultId);
  if (vault === null) {
    const globalMetrics = getOrCreateGlobalVaultMetric(block);
    vault = new Balancer(vaultId);
    vault.globalMetrics = globalMetrics.id;
    vault.save();
  }
  return vault;
}
