import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Amp } from '../types/schema';

export function getAmp(poolId: Bytes): Amp {
  let amp = Amp.load(poolId);
  if (amp === null) {
    amp = new Amp(poolId);
    amp.value = BigInt.zero();
    amp.save();
  }
  return amp;
}
