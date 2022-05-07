import { Balancer } from '../types/schema';
import { Bytes } from '@graphprotocol/graph-ts';

export function getVault(): Balancer {
  const id = Bytes.fromHexString('0x2');
  let vault: Balancer | null = Balancer.load(id);
  if (vault === null) {
    vault = new Balancer(id);
  }
  return vault;
}
