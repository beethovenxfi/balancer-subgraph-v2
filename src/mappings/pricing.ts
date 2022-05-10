import { Address, BigDecimal, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Pool } from '../types/schema';
import { ONE_BD, PRICING_ASSETS, USD_STABLE_ASSETS, ZERO_BD } from './helpers/constants';
import { hasVirtualSupply, PoolType } from './helpers/pools';
import { getPoolToken } from '../entities/pool-token';
import { createOrGetTokenPrice, getTokenPrice } from '../entities/token-price';
import { getOrCreateGlobalVaultMetric } from '../entities/vault-metrics';
import { getOrCreateGlobalPoolMetrics } from '../entities/pool-metrics';

export function isPricingAsset(asset: Address): boolean {
  for (let i: i32 = 0; i < PRICING_ASSETS.length; i++) {
    if (PRICING_ASSETS[i] == asset) return true;
  }
  return false;
}

/**
 *
 * @param poolId
 * @param block
 * @param pricingAsset
 * @param timestamp
 */
export function updatePoolLiquidity(poolId: Bytes, pricingAsset: Address, block: ethereum.Block): boolean {
  let pool = Pool.load(poolId);
  if (pool == null) return false;

  let tokensList: Bytes[] = pool.tokensList;
  if (tokensList.length < 2) return false;
  // in case the pool itself is a pricing asset, we don't want to update its liquidity todo: ??
  if (hasVirtualSupply(pool) && pool.address == pricingAsset) return false;

  // we first get the total pool value in relation to the pricing asset
  let poolValue: BigDecimal = ZERO_BD;

  // so we iterate over each pool token and add the balance in relation of the pricing asset
  for (let j: i32 = 0; j < tokensList.length; j++) {
    let tokenAddress: Address = Address.fromString(tokensList[j].toHexString());

    const poolToken = getPoolToken(poolId, tokenAddress);

    // the pool token which is the pricing asset can just be added directly
    if (tokenAddress == pricingAsset) {
      poolValue = poolValue.plus(poolToken.balance);
      continue;
    }
    let poolTokenQuantity: BigDecimal = poolToken.balance;

    // compare any new token price with the last price
    const tokenPrice = getTokenPrice(tokenAddress, pricingAsset);
    let price: BigDecimal = ZERO_BD;

    // note that we can only meaningfully report liquidity once assets are traded with
    // the pricing asset
    if (tokenPrice) {
      price = tokenPrice.price;
    } else if (pool.poolType == PoolType.StablePhantom) {
      // try to estimate token price in terms of pricing asset
      let pricingAssetInUSD = valueInUSD(ONE_BD, pricingAsset);
      let currentTokenInUSD = valueInUSD(ONE_BD, tokenAddress);

      if (pricingAssetInUSD.equals(ZERO_BD) || currentTokenInUSD.equals(ZERO_BD)) {
        continue;
      }

      price = currentTokenInUSD.div(pricingAssetInUSD);
    }

    // Exclude virtual supply from pool value
    if (hasVirtualSupply(pool) && pool.address == tokenAddress) {
      continue;
    }

    if (price) {
      let poolTokenValue = price.times(poolTokenQuantity);
      poolValue = poolValue.plus(poolTokenValue);
    }
  }

  const globalPoolMetric = getOrCreateGlobalPoolMetrics(poolId, block);

  let oldPoolLiquidity: BigDecimal = globalPoolMetric.totalLiquidity;
  let newPoolLiquidity: BigDecimal = valueInUSD(poolValue, pricingAsset) || ZERO_BD;
  let liquidityChange: BigDecimal = newPoolLiquidity.minus(oldPoolLiquidity);

  // If the pool isn't empty but we have a zero USD value then it's likely that we have a bad pricing asset
  // Don't commit any changes and just report the failure.
  if (poolValue.gt(ZERO_BD) != newPoolLiquidity.gt(ZERO_BD)) {
    return false;
  }

  // Take snapshot of pool state
  // let phlId = getPoolHistoricalLiquidityId(poolId, pricingAsset, block);
  // let phl = new PoolHistoricalLiquidity(phlId);
  // phl.poolId = poolId;
  // phl.pricingAsset = pricingAsset;
  // phl.block = block;
  // phl.timestamp = timestamp;
  // phl.poolTotalShares = pool.totalShares;
  // phl.poolLiquidity = poolValue;
  // phl.poolLiquidityUSD = newPoolLiquidity;
  // phl.poolShareValue = pool.totalShares.gt(ZERO_BD) ? poolValue.div(pool.totalShares) : ZERO_BD;
  // phl.save();

  // Update pool stats
  globalPoolMetric.totalLiquidity = newPoolLiquidity;
  globalPoolMetric.save();

  // todo: snapshots
  // Create or update pool daily snapshot
  // createPoolSnapshot(pool, timestamp);

  // Update global stats
  const globalVaultMetrics = getOrCreateGlobalVaultMetric(block);
  globalVaultMetrics.totalLiquidity = globalVaultMetrics.totalLiquidity.plus(liquidityChange);
  globalVaultMetrics.save();

  // let vaultSnapshot = getBalancerSnapshot(vault.id, timestamp);
  // vaultSnapshot.totalLiquidity = vault.totalLiquidity;
  // vaultSnapshot.save();

  return true;
}

export function valueInUSD(value: BigDecimal, pricingAsset: Address): BigDecimal {
  let usdValue = ZERO_BD;

  if (isUSDStable(pricingAsset)) {
    usdValue = value;
  } else {
    // convert to USD
    for (let i: i32 = 0; i < USD_STABLE_ASSETS.length; i++) {
      let pricingAssetInUSD = getTokenPrice(pricingAsset, USD_STABLE_ASSETS[i]);
      if (pricingAssetInUSD != null) {
        usdValue = value.times(pricingAssetInUSD.price);
        break;
      }
    }
  }

  return usdValue;
}

export function swapValueInUSD(
  tokenInAddress: Address,
  tokenAmountIn: BigDecimal,
  tokenOutAddress: Address,
  tokenAmountOut: BigDecimal
): BigDecimal {
  let swapValueUSD = ZERO_BD;

  if (isUSDStable(tokenOutAddress)) {
    swapValueUSD = valueInUSD(tokenAmountOut, tokenOutAddress);
  } else if (isUSDStable(tokenInAddress)) {
    swapValueUSD = valueInUSD(tokenAmountIn, tokenInAddress);
  } else {
    let tokenInSwapValueUSD = valueInUSD(tokenAmountIn, tokenInAddress);
    let tokenOutSwapValueUSD = valueInUSD(tokenAmountOut, tokenOutAddress);
    let divisor =
      tokenInSwapValueUSD.gt(ZERO_BD) && tokenOutSwapValueUSD.gt(ZERO_BD) ? BigDecimal.fromString('2') : ONE_BD;
    swapValueUSD = tokenInSwapValueUSD.plus(tokenOutSwapValueUSD).div(divisor);
  }

  return swapValueUSD;
}

function getLatestPriceId(tokenAddress: Address, pricingAsset: Address): string {
  return tokenAddress.toHexString().concat('-').concat(pricingAsset.toHexString());
}

function getPoolHistoricalLiquidityId(poolId: string, tokenAddress: Address, block: BigInt): string {
  return poolId.concat('-').concat(tokenAddress.toHexString()).concat('-').concat(block.toString());
}

export function isUSDStable(asset: Address): boolean {
  for (let i: i32 = 0; i < USD_STABLE_ASSETS.length; i++) {
    if (USD_STABLE_ASSETS[i] == asset) return true;
  }
  return false;
}
