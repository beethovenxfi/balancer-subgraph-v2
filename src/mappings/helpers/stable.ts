import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Amp, Pool } from '../../types/schema';
import { StablePool } from '../../types/templates/StablePool/StablePool';
import { ZERO } from './constants';
import { getAmp } from '../../entities/amp';

export function updateAmpFactor(pool: Pool): Amp {
  let poolContract = StablePool.bind(changetype<Address>(pool.address));
  const amp = getAmp(pool.id);
  amp.value = getOnChainAmp(poolContract);
  amp.save();
  return amp;
}

// TODO: allow passing MetaStablePool once AS supports union types
export function getOnChainAmp(poolContract: StablePool): BigInt {
  let ampCall = poolContract.try_getAmplificationParameter();
  let amp = ZERO;
  if (!ampCall.reverted) {
    let value = ampCall.value.value0;
    let precision = ampCall.value.value2;
    amp = value.div(precision);
  }
  return amp;
}
