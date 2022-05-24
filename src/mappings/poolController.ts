import { BigInt, log } from '@graphprotocol/graph-ts';
import { Transfer } from '../types/templates/WeightedPool/BalancerPoolToken';
import { SwapFeePercentageChanged } from '../types/templates/WeightedPool/WeightedPool';
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
import {
  GradualAmpUpdate,
  GradualWeightUpdate,
  LinearPoolTarget,
  Pool,
  PoolAddressToId,
  SwapConfig,
} from '../types/schema';

import { scaleDown, tokenToDecimal } from './helpers/misc';
import { ONE_BD, ZERO_ADDRESS, ZERO_BD } from './helpers/constants';
import { getPoolByAddress } from '../entities/pool';
import { getOrCreatePoolShares } from '../entities/pool-shares';
import { getOrCreateDailyPoolMetrics, getOrCreateLifetimePoolMetrics } from '../entities/pool-metrics';
import { updateAmpFactor } from './helpers/stable';
import { getOrCreatePriceRateProvider } from '../entities/price-rate-provider';
import { PriceRateCacheUpdated } from '../types/templates/LinearPool/MetaStablePool';
import { getOrCreateDailyUserPoolMetric } from '../entities/user';

/************************************
 *********** SWAP ENABLED ***********
 ************************************/

export function handleSwapEnabledSet(event: SwapEnabledSet): void {
  const mapping = PoolAddressToId.load(event.address);
  if (mapping == null) {
    log.warning('Pool not found - handleSwapEnabledSet. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
  const config = SwapConfig.load(mapping.poolId) as SwapConfig;
  config.swapEnabled = event.params.swapEnabled;
  config.save();
}

/************************************
 ********** WEIGHT UPDATES **********
 ************************************/

export function handleGradualWeightUpdateScheduled(event: GradualWeightUpdateScheduled): void {
  const poolMapping = PoolAddressToId.load(event.address);
  if (poolMapping == null) {
    log.warning('Pool not found -  handleGradualWeightUpdateScheduled. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
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
  const poolMapping = PoolAddressToId.load(event.address);
  if (poolMapping == null) {
    log.warning('Pool not found -  handleGradualWeightUpdateScheduled. PoolAddress {}', [event.address.toHexString()]);
    return;
  }

  let ampUpdate = GradualAmpUpdate.load(poolMapping.poolId);
  if (ampUpdate == null) {
    ampUpdate = new GradualAmpUpdate(poolMapping.poolId);
  }
  ampUpdate.poolData = poolMapping.poolId.toHexString();
  ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  ampUpdate.startTimestamp = event.params.startTime.toI32();
  ampUpdate.endTimestamp = event.params.endTime.toI32();
  ampUpdate.startAmp = event.params.startValue;
  ampUpdate.endAmp = event.params.endValue;
  ampUpdate.save();
}

export function handleAmpUpdateStopped(event: AmpUpdateStopped): void {
  const poolMapping = PoolAddressToId.load(event.address);
  if (poolMapping == null) {
    log.warning('Pool not found -  handleGradualWeightUpdateScheduled. PoolAddress {}', [event.address.toHexString()]);
    return;
  }

  let ampUpdate = GradualAmpUpdate.load(poolMapping.poolId);
  if (ampUpdate === null) {
    log.warning('Amp update not found - handleAmpUPdateStopped. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
  ampUpdate.endTimestamp = event.block.timestamp.toI32();
  ampUpdate.startAmp = event.params.currentValue;
  ampUpdate.endAmp = event.params.currentValue;
  ampUpdate.save();
  updateAmpFactor(Pool.load(poolMapping.poolId) as Pool);
}

/************************************
 *********** SWAP FEES ************
 ************************************/

export function handleSwapFeePercentageChange(event: SwapFeePercentageChanged): void {
  const mapping = PoolAddressToId.load(event.address);
  if (mapping == null) {
    log.warning('Pool not found - handleSwapFeePercentageChange. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
  const swapConfig = SwapConfig.load(mapping.poolId) as SwapConfig;
  swapConfig.fee = scaleDown(event.params.swapFeePercentage, 18);
  swapConfig.save();
}

/************************************
 ********* MANAGEMENT FEES **********
 ************************************/

export function handleManagementFeePercentageChanged(event: ManagementFeePercentageChanged): void {
  const mapping = PoolAddressToId.load(event.address);
  if (mapping == null) {
    log.warning('Pool not found - handleManagementFeePercentageChange. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
  const swapConfig = SwapConfig.load(mapping.poolId) as SwapConfig;
  swapConfig.managementFee = scaleDown(event.params.managementFeePercentage, 18);
  swapConfig.save();
}

/************************************
 ************* TARGETS **************
 ************************************/

export function handleTargetsSet(event: TargetsSet): void {
  const poolMapping = PoolAddressToId.load(event.address);
  if (poolMapping == null) {
    log.warning('Pool not found - handleTargetsSet. PoolAddress {}', [event.address.toHexString()]);
    return;
  }

  const target = LinearPoolTarget.load(poolMapping.poolId) as LinearPoolTarget;
  target.lowerTarget = tokenToDecimal(event.params.lowerTarget, 18);
  target.upperTarget = tokenToDecimal(event.params.upperTarget, 18);
  target.save();
}

/************************************
 ******** PRICE RATE UPDATE *********
 ************************************/

export function handlePriceRateProviderSet(event: PriceRateProviderSet): void {
  const poolMapping = PoolAddressToId.load(event.address);
  if (poolMapping == null) {
    log.warning('Pool not found - handlePriceRateProviderSet. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
  let blockTimestamp = event.block.timestamp.toI32();

  const provider = getOrCreatePriceRateProvider(poolMapping.poolId, event.params.token);
  provider.poolData = poolMapping.poolId.toHexString();
  provider.token = event.params.token;
  provider.tokenAddress = event.params.token;
  provider.address = event.params.provider;
  provider.rate = ONE_BD;
  provider.lastCached = blockTimestamp;
  provider.cacheExpiry = blockTimestamp + event.params.cacheDuration.toI32();
  provider.cacheDuration = event.params.cacheDuration.toI32();
  provider.save();
}

export function handlePriceRateCacheUpdated(event: PriceRateCacheUpdated): void {
  const poolMapping = PoolAddressToId.load(event.address);
  if (poolMapping == null) {
    log.warning('Pool not found - handlePriceRateCacheUpdate. PoolAddress {}', [event.address.toHexString()]);
    return;
  }
  const provider = getOrCreatePriceRateProvider(poolMapping.poolId, event.params.token);

  provider.rate = scaleDown(event.params.rate, 18);
  provider.lastCached = event.block.timestamp.toI32();
  provider.cacheExpiry = event.block.timestamp.toI32() + provider.cacheDuration;

  provider.save();
}

/************************************
 *********** POOL SHARES ************
 ************************************/

export function handleTransfer(event: Transfer): void {
  const pool = getPoolByAddress(event.address);

  let isMint = event.params.from.toHex() == ZERO_ADDRESS;
  let isBurn = event.params.to.toHex() == ZERO_ADDRESS;

  const lifetimePoolMetric = getOrCreateLifetimePoolMetrics(pool.id, event.block);
  const dailyPoolMetric = getOrCreateDailyPoolMetrics(pool.id, event.block);

  let BPT_DECIMALS = 18;

  const poolSharesFrom = getOrCreatePoolShares(pool.id, event.params.from, event.address);
  const sharesFromBeforeSwap = poolSharesFrom.balance;
  const poolSharesTo = getOrCreatePoolShares(pool.id, event.params.to, event.address);
  const sharesToBeforeSwap = poolSharesTo.balance;
  const amount = tokenToDecimal(event.params.value, BPT_DECIMALS);

  const dailyUserPoolToMetric = getOrCreateDailyUserPoolMetric(pool.id, event.params.to, event.block);
  const dailyUserPoolFromMetric = getOrCreateDailyUserPoolMetric(pool.id, event.params.from, event.block);

  if (isMint) {
    poolSharesTo.balance = poolSharesTo.balance.plus(amount);
    lifetimePoolMetric.totalShares = lifetimePoolMetric.totalShares.plus(amount);
    dailyPoolMetric.totalShares = dailyPoolMetric.totalShares.plus(amount);
    poolSharesTo.save();
    lifetimePoolMetric.save();
    dailyPoolMetric.save();
    dailyUserPoolToMetric.totalShares = dailyUserPoolToMetric.totalShares.plus(amount);
    dailyUserPoolToMetric.save();
  } else if (isBurn) {
    poolSharesFrom.balance = poolSharesFrom.balance.minus(amount);
    poolSharesFrom.save();
    lifetimePoolMetric.totalShares = lifetimePoolMetric.totalShares.minus(amount);
    dailyPoolMetric.totalShares = dailyPoolMetric.totalShares.minus(amount);
    poolSharesFrom.save();
    lifetimePoolMetric.save();
    dailyPoolMetric.save();
    dailyUserPoolFromMetric.totalShares = dailyUserPoolFromMetric.totalShares.minus(amount);
    dailyUserPoolFromMetric.save();
  } else {
    poolSharesTo.balance = poolSharesTo.balance.plus(amount);
    poolSharesTo.save();
    dailyUserPoolToMetric.totalShares = dailyUserPoolToMetric.totalShares.plus(amount);
    dailyUserPoolToMetric.save();

    poolSharesFrom.balance = poolSharesFrom.balance.minus(amount);
    poolSharesFrom.save();
    dailyUserPoolFromMetric.totalShares = dailyUserPoolFromMetric.totalShares.minus(amount);
    dailyUserPoolFromMetric.save();
  }

  if (poolSharesTo.balance.notEqual(ZERO_BD) && sharesToBeforeSwap.equals(ZERO_BD)) {
    lifetimePoolMetric.holdersCount = lifetimePoolMetric.holdersCount.plus(BigInt.fromI32(1));
    lifetimePoolMetric.save();
  }

  if (poolSharesFrom.balance.equals(ZERO_BD) && sharesFromBeforeSwap.notEqual(ZERO_BD)) {
    lifetimePoolMetric.holdersCount = lifetimePoolMetric.holdersCount.minus(BigInt.fromI32(1));
    lifetimePoolMetric.save();
  }
}
