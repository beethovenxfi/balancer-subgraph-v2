import { BigInt, log } from '@graphprotocol/graph-ts';
import { Transfer } from '../types/templates/WeightedPool/BalancerPoolToken';
import { SwapFeePercentageChanged, WeightedPool } from '../types/templates/WeightedPool/WeightedPool';
import {
  GradualWeightUpdateScheduled,
  SwapEnabledSet,
} from '../types/templates/LiquidityBootstrappingPool/LiquidityBootstrappingPool';
import { ManagementFeePercentageChanged } from '../types/templates/InvestmentPool/InvestmentPool';
import { TargetsSet } from '../types/templates/LinearPool/LinearPool';
import {
  AmpUpdateStarted,
  AmpUpdateStopped,
  PriceRateProviderSet,
} from '../types/templates/MetaStablePool/MetaStablePool';
import { GradualWeightUpdate, PoolAddressToId, SwapConfig } from '../types/schema';

import { scaleDown, tokenToDecimal } from './helpers/misc';
import { ZERO_ADDRESS, ZERO_BD } from './helpers/constants';
import { getPoolByAddress } from '../entities/pool';
import { getOrCreatePoolShares } from '../entities/pool-shares';
import { getOrCreateGlobalPoolMetrics } from '../entities/pool-metrics';

/************************************
 *********** SWAP ENABLED ***********
 ************************************/

export function handleSwapEnabledSet(event: SwapEnabledSet): void {
  const mapping = PoolAddressToId.load(event.address) as PoolAddressToId;
  const config = SwapConfig.load(mapping.poolId) as SwapConfig;
  config.swapEnabled = event.params.swapEnabled;
  config.save();
}

/************************************
 ********** WEIGHT UPDATES **********
 ************************************/

export function handleGradualWeightUpdateScheduled(event: GradualWeightUpdateScheduled): void {
  let poolAddress = event.address;

  const poolMapping = PoolAddressToId.load(poolAddress);
  if (poolMapping == null) {
    log.warning('Pool not found -  handleGradualWeightUpdateScheduled. PoolAddress {}', [poolAddress.toHexString()]);
    return;
  }
  // let id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  // todo: can we do this with pool id?
  let weightUpdate = new GradualWeightUpdate(poolMapping.poolId);
  weightUpdate.pool = poolMapping.poolId;
  weightUpdate.poolId = poolMapping.poolId;
  weightUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  weightUpdate.startTimestamp = event.params.startTime.toI32();
  weightUpdate.endTimestamp = event.params.endTime.toI32();
  weightUpdate.startWeights = event.params.startWeights;
  weightUpdate.endWeights = event.params.endWeights;
  weightUpdate.save();
}

/************************************
 *********** AMP UPDATES ************
 ************************************/

export function handleAmpUpdateStarted(event: AmpUpdateStarted): void {
  // let poolAddress = event.address;
  //
  // // TODO - refactor so pool -> poolId doesn't require call
  // let poolContract = WeightedPool.bind(poolAddress);
  // let poolIdCall = poolContract.try_getPoolId();
  // let poolId = poolIdCall.value;
  //
  // let id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  // let ampUpdate = new AmpUpdate(id);
  // ampUpdate.poolId = poolId.toHexString();
  // ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  // ampUpdate.startTimestamp = event.params.startTime.toI32();
  // ampUpdate.endTimestamp = event.params.endTime.toI32();
  // ampUpdate.startAmp = event.params.startValue;
  // ampUpdate.endAmp = event.params.endValue;
  // ampUpdate.save();
}

export function handleAmpUpdateStopped(event: AmpUpdateStopped): void {
  // let poolAddress = event.address;
  //
  // // TODO - refactor so pool -> poolId doesn't require call
  // let poolContract = WeightedPool.bind(poolAddress);
  // let poolIdCall = poolContract.try_getPoolId();
  // let poolId = poolIdCall.value.toHexString();
  //
  // let id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  // let ampUpdate = new AmpUpdate(id);
  // ampUpdate.poolId = poolId;
  // ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  // ampUpdate.startTimestamp = event.block.timestamp.toI32();
  // ampUpdate.endTimestamp = event.block.timestamp.toI32();
  // ampUpdate.startAmp = event.params.currentValue;
  // ampUpdate.endAmp = event.params.currentValue;
  // ampUpdate.save();
  //
  // let pool = Pool.load(poolId);
  // if (pool == null) return;
  // updateAmpFactor(pool);
}

/************************************
 *********** SWAP FEES ************
 ************************************/

export function handleSwapFeePercentageChange(event: SwapFeePercentageChanged): void {
  const mapping = PoolAddressToId.load(event.address) as PoolAddressToId;
  const swapConfig = SwapConfig.load(mapping.poolId) as SwapConfig;
  swapConfig.fee = scaleDown(event.params.swapFeePercentage, 18);
  swapConfig.save();
}

/************************************
 ********* MANAGEMENT FEES **********
 ************************************/

export function handleManagementFeePercentageChanged(event: ManagementFeePercentageChanged): void {
  // let poolAddress = event.address;
  //
  // // TODO - refactor so pool -> poolId doesn't require call
  // let poolContract = WeightedPool.bind(poolAddress);
  // let poolIdCall = poolContract.try_getPoolId();
  // let poolId = poolIdCall.value;
  //
  // let pool = Pool.load(poolId.toHexString()) as Pool;
  //
  // pool.managementFee = scaleDown(event.params.managementFeePercentage, 18);
  // pool.save();
}

/************************************
 ************* TARGETS **************
 ************************************/

export function handleTargetsSet(event: TargetsSet): void {
  // let poolAddress = event.address;
  //
  // // TODO - refactor so pool -> poolId doesn't require call
  // let poolContract = WeightedPool.bind(poolAddress);
  // let poolIdCall = poolContract.try_getPoolId();
  // let poolId = poolIdCall.value;
  //
  // let pool = Pool.load(poolId.toHexString()) as Pool;
  //
  // pool.lowerTarget = tokenToDecimal(event.params.lowerTarget, 18);
  // pool.upperTarget = tokenToDecimal(event.params.upperTarget, 18);
  // pool.save();
}

/************************************
 ******** PRICE RATE UPDATE *********
 ************************************/

export function handlePriceRateProviderSet(event: PriceRateProviderSet): void {
  let poolAddress = event.address;
  //
  const poolMapping = PoolAddressToId.load(poolAddress) as PoolAddressToId;
  // // TODO - refactor so pool -> poolId doesn't require call
  // let poolContract = MetaStablePool.bind(poolAddress);
  // let poolIdCall = poolContract.try_getPoolId();
  // let poolId = poolIdCall.value;
  //
  let blockTimestamp = event.block.timestamp.toI32();
  //
  // let provider = loadPriceRateProvider(poolId.toHexString(), event.params.token);

  // if (provider == null) {
  //   // Price rate providers and pooltokens share an ID
  //   let providerId = getPoolTokenId(poolId.toHexString(), event.params.token);
  //   provider = new PriceRateProvider(providerId);
  //   provider.poolId = poolId.toHexString();
  //   provider.token = providerId;
  //
  //   // Default to a rate of one, this should be updated in `handlePriceRateCacheUpdated` immediately
  //   provider.rate = ONE_BD;
  //   provider.lastCached = blockTimestamp;
  //   provider.cacheExpiry = blockTimestamp + event.params.cacheDuration.toI32();
  // }
  //
  // provider.address = event.params.provider;
  // provider.cacheDuration = event.params.cacheDuration.toI32();
  //
  // provider.save();
}

// export function handlePriceRateCacheUpdated(event: PriceRateCacheUpdated): void {
//   let poolAddress = event.address;
//
//   // TODO - refactor so pool -> poolId doesn't require call
//   let poolContract = MetaStablePool.bind(poolAddress);
//   let poolIdCall = poolContract.try_getPoolId();
//   let poolId = poolIdCall.value;
//
//   let provider = loadPriceRateProvider(poolId.toHexString(), event.params.token);
//   if (provider == null) {
//     log.warning('Provider not found in handlePriceRateCacheUpdated: {} {}', [
//       poolId.toHexString(),
//       event.params.token.toHexString(),
//     ]);
//     return;
//   }
//
//   provider.rate = scaleDown(event.params.rate, 18);
//   provider.lastCached = event.block.timestamp.toI32();
//   provider.cacheExpiry = event.block.timestamp.toI32() + provider.cacheDuration;
//
//   provider.save();
//
//   // Attach the rate onto the PoolToken entity as well
//   let poolToken = loadPoolToken(poolId.toHexString(), event.params.token);
//   if (poolToken == null) return;
//   poolToken.priceRate = provider.rate;
//   poolToken.save();
// }

/************************************
 *********** POOL SHARES ************
 ************************************/

export function handleTransfer(event: Transfer): void {
  const pool = getPoolByAddress(event.address);

  let isMint = event.params.from.toHex() == ZERO_ADDRESS;
  let isBurn = event.params.to.toHex() == ZERO_ADDRESS;

  const globalPoolMetrics = getOrCreateGlobalPoolMetrics(pool.id, event.block);

  let BPT_DECIMALS = 18;

  const poolSharesFrom = getOrCreatePoolShares(pool.id, event.params.from, event.address);
  const sharesFromBeforeSwap = poolSharesFrom.balance;
  const poolSharesTo = getOrCreatePoolShares(pool.id, event.params.to, event.address);
  const sharesToBeforeSwap = poolSharesTo.balance;
  if (isMint) {
    poolSharesTo.balance = poolSharesTo.balance.plus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    globalPoolMetrics.totalShares = globalPoolMetrics.totalShares.plus(
      tokenToDecimal(event.params.value, BPT_DECIMALS)
    );
    poolSharesTo.save();
    globalPoolMetrics.save();
  } else if (isBurn) {
    poolSharesFrom.balance = poolSharesFrom.balance.minus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolSharesFrom.save();
    globalPoolMetrics.totalShares = globalPoolMetrics.totalShares.minus(
      tokenToDecimal(event.params.value, BPT_DECIMALS)
    );
    poolSharesFrom.save();
    globalPoolMetrics.save();
  } else {
    poolSharesTo.balance = poolSharesTo.balance.plus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolSharesTo.save();

    poolSharesFrom.balance = poolSharesFrom.balance.minus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolSharesFrom.save();
    globalPoolMetrics.save();
  }

  if (poolSharesTo.balance.notEqual(ZERO_BD) && sharesToBeforeSwap.equals(ZERO_BD)) {
    globalPoolMetrics.holdersCount = globalPoolMetrics.holdersCount.plus(BigInt.fromI32(1));
    globalPoolMetrics.save();
  }

  if (poolSharesFrom.balance.equals(ZERO_BD) && sharesFromBeforeSwap.notEqual(ZERO_BD)) {
    globalPoolMetrics.holdersCount = globalPoolMetrics.holdersCount.minus(BigInt.fromI32(1));
    globalPoolMetrics.save();
  }
}
