import { PriceRateProvider } from '../types/schema';
import { Address } from '@graphprotocol/graph-ts/index';
import { BigDecimal } from '@graphprotocol/graph-ts';

export function getOrCreatePriceRateProvider(providerAddress: Address, tokenAddress: Address): PriceRateProvider {
  let priceRateProvider = PriceRateProvider.load(tokenAddress);

  if (priceRateProvider === null) {
    priceRateProvider = new PriceRateProvider(tokenAddress);
    priceRateProvider.token = tokenAddress;
    priceRateProvider.tokenAddress = tokenAddress;
    priceRateProvider.address = providerAddress;
    priceRateProvider.rate = BigDecimal.zero();
    priceRateProvider.lastCached = 0;
    priceRateProvider.cacheDuration = 0;
    priceRateProvider.cacheExpiry = 0;
    priceRateProvider.save();
  }
  return priceRateProvider;
}
