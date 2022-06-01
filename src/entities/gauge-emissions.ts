import { Address } from '@graphprotocol/graph-ts/index';
import { GaugeFactory, GaugeRewardToken } from '../types/schema';
import { BigDecimal } from '@graphprotocol/graph-ts';
import { getOrCreateToken } from './token';

export function getGaugeFactory(address: Address): GaugeFactory {
  let factory = GaugeFactory.load(address.toHexString());

  if (factory == null) {
    factory = new GaugeFactory(address.toHexString());
    factory.numGauges = 0;
    factory.save();
  }

  return factory;
}

export function getOrCreateGaugeRewardToken(tokenAddress: Address, gaugeAddress: Address): GaugeRewardToken {
  let id = tokenAddress.concat(gaugeAddress);
  let rewardToken = GaugeRewardToken.load(id);

  if (rewardToken == null) {
    const token = getOrCreateToken(tokenAddress, false);
    rewardToken = new GaugeRewardToken(id);
    rewardToken.emissionProvider = gaugeAddress;
    rewardToken.token = token.id;
    rewardToken.tokenAddress = tokenAddress;
    rewardToken.totalDeposited = BigDecimal.zero();
    rewardToken.save();
  }

  return rewardToken;
}
