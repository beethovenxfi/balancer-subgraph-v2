import { Address, Bytes } from '@graphprotocol/graph-ts';

import { Pool } from '../../types/schema';
import { WeightedPool } from '../../types/templates/WeightedPool/WeightedPool';
import { scaleDown } from './misc';
import { getTokenWeight } from '../../entities/token-weight';

export function updatePoolWeights(poolId: Bytes): void {
  let pool = Pool.load(poolId);
  if (pool == null) return;

  let poolContract = WeightedPool.bind(changetype<Address>(pool.address));

  let tokensList = pool.tokenAddresses;
  let weightsCall = poolContract.try_getNormalizedWeights();
  if (!weightsCall.reverted) {
    let weights = weightsCall.value;

    for (let i: i32 = 0; i < tokensList.length; i++) {
      let tokenAddress = changetype<Address>(tokensList[i]);
      let weight = weights[i];

      const tokenWeight = getTokenWeight(poolId, tokenAddress);
      if (tokenWeight != null) {
        tokenWeight.weight = scaleDown(weight, 18);
        tokenWeight.save();
      }
    }
  }
}
