import { Address } from '@graphprotocol/graph-ts/index';
import { TokenPrice } from '../types/schema';
import { BigDecimal, ethereum } from '@graphprotocol/graph-ts';

export function createOrGetTokenPrice(
  tokenAddress: Address,
  stableTokenAddress: Address,
  block: ethereum.Block
): TokenPrice {
  let tokenPrice = TokenPrice.load(tokenAddress.concat(stableTokenAddress));
  if (tokenPrice == null) {
    tokenPrice = new TokenPrice(tokenAddress.concat(stableTokenAddress));
    tokenPrice.tokenAddress = tokenAddress;
    tokenPrice.token = tokenAddress;
    tokenPrice.pricingAsset = stableTokenAddress;
    tokenPrice.price = BigDecimal.zero();
    tokenPrice.priceUSD = BigDecimal.zero();
    tokenPrice.block = block.number;
    tokenPrice.timestamp = block.timestamp.toI32();
  }
  tokenPrice.save();

  return tokenPrice;
}

export function getTokenPrice(tokenAddress: Address, stableTokenAddress: Address): TokenPrice | null {
  return TokenPrice.load(tokenAddress.concat(stableTokenAddress));
}
