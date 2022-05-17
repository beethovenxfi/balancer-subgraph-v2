import { PriceRateProvider } from '../types/schema';
import { Address } from '@graphprotocol/graph-ts/index';
import { ONE_BD } from '../mappings/helpers/constants';
import { Bytes } from '@graphprotocol/graph-ts';

export function getOrCreatePriceRateProvider(poolId: Bytes, tokenAddress: Address): PriceRateProvider {
  let priceRateProvider = PriceRateProvider.load(tokenAddress);

  if (priceRateProvider === null) {
    priceRateProvider = new PriceRateProvider(tokenAddress);
    priceRateProvider.token = tokenAddress;
    priceRateProvider.tokenAddress = tokenAddress;
    priceRateProvider.address = Address.zero();
    priceRateProvider.rate = ONE_BD;
    priceRateProvider.lastCached = 0;
    priceRateProvider.cacheDuration = 0;
    priceRateProvider.cacheExpiry = 0;
    priceRateProvider.save();
  }
  return priceRateProvider;
}
