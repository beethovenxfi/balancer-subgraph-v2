import { Balancer } from '../types/schema';
import { Bytes, ethereum } from '@graphprotocol/graph-ts';
import { getOrCreateGlobalVaultMetric } from './vault-metrics';

export function getOrCreateVault(block: ethereum.Block): Balancer {
  const id = Bytes.fromI32(2);
  let vault: Balancer | null = Balancer.load(id);
  if (vault === null) {
    const globalMetrics = getOrCreateGlobalVaultMetric(block);
    vault = new Balancer(id);
    vault.globalMetrics = globalMetrics.id;
    vault.save();
  }
  return vault;
}
