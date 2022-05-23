import { Address } from '@graphprotocol/graph-ts/index';
import { HourlyTokenPrice, TokenPrice } from '../types/schema';
import { BigDecimal, ethereum } from '@graphprotocol/graph-ts';

export function getOrCreateTokenPrice(tokenAddress: Address, pricingAsset: Address, block: ethereum.Block): TokenPrice {
  const id = tokenAddress.concat(pricingAsset);
  let tokenPrice = TokenPrice.load(id);
  if (tokenPrice === null) {
    tokenPrice = new TokenPrice(id);
    tokenPrice.tokenAddress = tokenAddress;
    tokenPrice.token = tokenAddress;
    tokenPrice.pricingAsset = pricingAsset;
    tokenPrice.price = BigDecimal.zero();
    tokenPrice.amount = BigDecimal.zero();
    tokenPrice.priceUSD = BigDecimal.zero();
    tokenPrice.block = block.number;
    tokenPrice.timestamp = block.timestamp.toI32();
    tokenPrice.save();
  }

  return tokenPrice;
}

export function getTokenPrice(tokenAddress: Address, pricingAsset: Address): TokenPrice | null {
  return TokenPrice.load(tokenAddress.concat(pricingAsset));
}

export function getOrCreateHourlyTokenPrice(tokenAddress: Address, block: ethereum.Block): HourlyTokenPrice {
  let timestamp = block.timestamp.toI32();
  const hourId = timestamp / 3600;
  const id = tokenAddress.concatI32(hourId);
  let hourlyTokenPrice = HourlyTokenPrice.load(id);
  if (hourlyTokenPrice == null) {
    hourlyTokenPrice = new HourlyTokenPrice(id);
    hourlyTokenPrice.tokenAddress = tokenAddress;
    hourlyTokenPrice.token = tokenAddress;
    hourlyTokenPrice.hour = hourId;
    hourlyTokenPrice.startTime = hourId * 3600;
    hourlyTokenPrice.avgPriceUSD = BigDecimal.zero();
    hourlyTokenPrice.endPriceUSD = BigDecimal.zero();
    hourlyTokenPrice.dataPoints = BigDecimal.zero();
    hourlyTokenPrice.save();
  }
  return hourlyTokenPrice;
}
