import { WeightedPoolData } from '../types/schema';
import { Bytes } from '@graphprotocol/graph-ts';

// export function createWeightedPoolData(poolId: Bytes): WeightedPoolData {
//   let weightedPoolData = WeightedPoolData.load(poolId);
//
//   if (weightedPoolData == null) {
//     weightedPoolData = new WeightedPoolData(poolId);
//     weightedPoolData.pool = poolId;
//     weightedPoolData.poolId = poolId;
//     weightedPoolData.save();
//   }
//   return weightedPoolData;
// }
