import { StablePoolData } from '../types/schema';
import { Bytes } from '@graphprotocol/graph-ts';

export function getStablePoolData(poolId: Bytes): StablePoolData {
  let stablePoolData = StablePoolData.load(poolId);

  if (stablePoolData == null) {
    stablePoolData = new StablePoolData(poolId);
  }
}
