import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import { Transfer } from '../types/templates/WeightedPool/BalancerPoolToken';
import { OracleEnabledChanged } from '../types/templates/WeightedPool2Tokens/WeightedPool2Tokens';
import { WeightedPool, SwapFeePercentageChanged } from '../types/templates/WeightedPool/WeightedPool';
import {
  GradualWeightUpdateScheduled,
  SwapEnabledSet,
} from '../types/templates/LiquidityBootstrappingPool/LiquidityBootstrappingPool';
import { ManagementFeePercentageChanged } from '../types/templates/InvestmentPool/InvestmentPool';
import { TargetsSet } from '../types/templates/LinearPool/LinearPool';
import {
  AmpUpdateStarted,
  AmpUpdateStopped,
  MetaStablePool,
  PriceRateCacheUpdated,
  PriceRateProviderSet,
} from '../types/templates/MetaStablePool/MetaStablePool';
import {
  TokenRateCacheUpdated,
  TokenRateProviderSet,
} from '../types/templates/StablePhantomPoolV2/ComposableStablePool';
import { AssimilatorIncluded, ParametersSet } from '../types/templates/FXPool/FXPool';
import {
  Pool,
  PriceRateProvider,
  GradualWeightUpdate,
  AmpUpdate,
  SwapFeeUpdate,
  PoolHistoricalLiquidity,
} from '../types/schema';

import {
  tokenToDecimal,
  scaleDown,
  loadPoolToken,
  getPoolTokenId,
  loadPriceRateProvider,
  getPoolShare,
  getToken,
} from './helpers/misc';
import { ONE_BD, ProtocolFeeType, PROTOCOL_FEE_COLLECTOR_ADDRESS, ZERO_ADDRESS, ZERO_BD } from './helpers/constants';
import { updateAmpFactor } from './helpers/stable';
import { ProtocolFeePercentageCacheUpdated } from '../types/WeightedPoolV2Factory/WeightedPoolV2';
import { getPoolTokens, PoolType } from './helpers/pools';

export function handleProtocolFeePercentageCacheUpdated(event: ProtocolFeePercentageCacheUpdated): void {
  let poolAddress = event.address;
  let poolContract = WeightedPool.bind(poolAddress);

  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  const feeType = event.params.feeType.toI32();
  const feePercentage = scaleDown(event.params.protocolFeePercentage, 18);

  if (feeType == ProtocolFeeType.Swap) {
    pool.protocolSwapFeeCache = feePercentage;
  } else if (feeType == ProtocolFeeType.Yield) {
    pool.protocolYieldFeeCache = feePercentage;
  } else if (feeType == ProtocolFeeType.Aum) {
    pool.protocolAumFeeCache = feePercentage;
  }

  pool.save();
}

/************************************
 *********** SWAP ENABLED ***********
 ************************************/

export function handleOracleEnabledChanged(event: OracleEnabledChanged): void {
  let poolAddress = event.address;
  let poolContract = WeightedPool.bind(poolAddress);

  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;
  pool.oracleEnabled = event.params.enabled;
  pool.save();
}

export function handleSwapEnabledSet(event: SwapEnabledSet): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  pool.swapEnabled = event.params.swapEnabled;
  pool.save();
}

/************************************
 ********** WEIGHT UPDATES **********
 ************************************/

export function handleGradualWeightUpdateScheduled(event: GradualWeightUpdateScheduled): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  let weightUpdate = new GradualWeightUpdate(id);
  weightUpdate.poolId = poolId.toHexString();
  weightUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  weightUpdate.startTimestamp = event.params.startTime;
  weightUpdate.endTimestamp = event.params.endTime;
  weightUpdate.startWeights = event.params.startWeights;
  weightUpdate.endWeights = event.params.endWeights;
  weightUpdate.save();
}

/************************************
 *********** AMP UPDATES ************
 ************************************/

export function handleAmpUpdateStarted(event: AmpUpdateStarted): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  let ampUpdate = new AmpUpdate(id);
  ampUpdate.poolId = poolId.toHexString();
  ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  ampUpdate.startTimestamp = event.params.startTime;
  ampUpdate.endTimestamp = event.params.endTime;
  ampUpdate.startAmp = event.params.startValue;
  ampUpdate.endAmp = event.params.endValue;
  ampUpdate.save();
}

export function handleAmpUpdateStopped(event: AmpUpdateStopped): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value.toHexString();

  let id = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  let ampUpdate = new AmpUpdate(id);
  ampUpdate.poolId = poolId;
  ampUpdate.scheduledTimestamp = event.block.timestamp.toI32();
  ampUpdate.startTimestamp = event.block.timestamp;
  ampUpdate.endTimestamp = event.block.timestamp;
  ampUpdate.startAmp = event.params.currentValue;
  ampUpdate.endAmp = event.params.currentValue;
  ampUpdate.save();

  let pool = Pool.load(poolId);
  if (pool == null) return;
  updateAmpFactor(pool);
}

/************************************
 *********** SWAP FEES ************
 ************************************/

export function handleSwapFeePercentageChange(event: SwapFeePercentageChanged): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  const newSwapFee = scaleDown(event.params.swapFeePercentage, 18);
  pool.swapFee = newSwapFee;
  pool.save();

  const swapFeeUpdateID = event.transaction.hash.toHexString().concat(event.transactionLogIndex.toString());
  createSwapFeeUpdate(
    swapFeeUpdateID,
    pool,
    event.block.timestamp.toI32(),
    event.block.timestamp,
    event.block.timestamp,
    newSwapFee,
    newSwapFee
  );
}

export function createSwapFeeUpdate(
  _id: string,
  _pool: Pool,
  _blockTimestamp: i32,
  _startTimestamp: BigInt,
  _endTimestamp: BigInt,
  _startSwapFeePercentage: BigDecimal,
  _endSwapFeePercentage: BigDecimal
): void {
  let swapFeeUpdate = new SwapFeeUpdate(_id);
  swapFeeUpdate.pool = _pool.id;
  swapFeeUpdate.scheduledTimestamp = _blockTimestamp;
  swapFeeUpdate.startTimestamp = _startTimestamp;
  swapFeeUpdate.endTimestamp = _endTimestamp;
  swapFeeUpdate.startSwapFeePercentage = _startSwapFeePercentage;
  swapFeeUpdate.endSwapFeePercentage = _endSwapFeePercentage;
  swapFeeUpdate.save();
}

/************************************
 ********* MANAGEMENT FEES **********
 ************************************/

export function handleManagementFeePercentageChanged(event: ManagementFeePercentageChanged): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  pool.managementFee = scaleDown(event.params.managementFeePercentage, 18);
  pool.save();
}

/************************************
 ************* TARGETS **************
 ************************************/

export function handleTargetsSet(event: TargetsSet): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  pool.lowerTarget = tokenToDecimal(event.params.lowerTarget, 18);
  pool.upperTarget = tokenToDecimal(event.params.upperTarget, 18);
  pool.save();
}

/************************************
 ******** PRICE RATE UPDATE *********
 ************************************/

export function handlePriceRateProviderSet(event: PriceRateProviderSet): void {
  setPriceRateProvider(
    event.address,
    event.params.token,
    event.params.provider,
    event.params.cacheDuration.toI32(),
    event.block.timestamp.toI32()
  );
}

export function handleTokenRateProviderSet(event: TokenRateProviderSet): void {
  let poolContract = MetaStablePool.bind(event.address);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value.toHexString();
  let pool = Pool.load(poolId) as Pool;
  let token = pool.tokensList[event.params.tokenIndex.toI32()];
  let tokenAddress = Address.fromString(token.toHexString());

  setPriceRateProvider(
    event.address,
    tokenAddress,
    event.params.provider,
    event.params.cacheDuration.toI32(),
    event.block.timestamp.toI32()
  );
}

export function setPriceRateProvider(
  poolAddress: Address,
  tokenAddress: Address,
  providerAdress: Address,
  cacheDuration: i32,
  blockTimestamp: i32
): void {
  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = MetaStablePool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let provider = loadPriceRateProvider(poolId.toHexString(), tokenAddress);
  if (provider == null) {
    // Price rate providers and pooltokens share an ID
    let providerId = getPoolTokenId(poolId.toHexString(), tokenAddress);
    provider = new PriceRateProvider(providerId);
    provider.poolId = poolId.toHexString();
    provider.token = providerId;

    // Default to a rate of one, this should be updated in `handlePriceRateCacheUpdated` eventually
    provider.rate = ONE_BD;
    provider.lastCached = blockTimestamp;
    provider.cacheExpiry = blockTimestamp + cacheDuration;
  }

  provider.address = providerAdress;
  provider.cacheDuration = cacheDuration;

  provider.save();
}

export function handlePriceRateCacheUpdated(event: PriceRateCacheUpdated): void {
  setPriceRateCache(event.address, event.params.token, event.params.rate, event.block.timestamp.toI32());
}

export function handleTokenRateCacheUpdated(event: TokenRateCacheUpdated): void {
  let poolContract = MetaStablePool.bind(event.address);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value.toHexString();
  let pool = Pool.load(poolId) as Pool;
  let token = pool.tokensList[event.params.tokenIndex.toI32()];
  let tokenAddress = Address.fromString(token.toHexString());

  setPriceRateCache(event.address, tokenAddress, event.params.rate, event.block.timestamp.toI32());
}

export function setPriceRateCache(
  poolAddress: Address,
  tokenAddress: Address,
  rate: BigInt,
  blockTimestamp: i32
): void {
  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = MetaStablePool.bind(poolAddress);
  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let rateScaled = scaleDown(rate, 18);
  let provider = loadPriceRateProvider(poolId.toHexString(), tokenAddress);
  if (provider == null) {
    log.warning('Provider not found in handlePriceRateCacheUpdated: {} {}', [
      poolId.toHexString(),
      tokenAddress.toHexString(),
    ]);
  } else {
    provider.rate = rateScaled;
    provider.lastCached = blockTimestamp;
    provider.cacheExpiry = blockTimestamp + provider.cacheDuration;

    provider.save();
  }

  // Attach the rate onto the PoolToken entity
  let poolToken = loadPoolToken(poolId.toHexString(), tokenAddress);
  if (poolToken == null) return;
  poolToken.priceRate = rateScaled;
  poolToken.save();
}

/************************************
 *********** POOL SHARES ************
 ************************************/

export function handleTransfer(event: Transfer): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);

  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let isMint = event.params.from == ZERO_ADDRESS;
  let isBurn = event.params.to == ZERO_ADDRESS;

  let poolShareFrom = getPoolShare(poolId.toHexString(), event.params.from);
  let poolShareFromBalance = poolShareFrom == null ? ZERO_BD : poolShareFrom.balance;

  let poolShareTo = getPoolShare(poolId.toHexString(), event.params.to);
  let poolShareToBalance = poolShareTo == null ? ZERO_BD : poolShareTo.balance;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  let BPT_DECIMALS = 18;

  if (isMint) {
    poolShareTo.balance = poolShareTo.balance.plus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolShareTo.save();
    pool.totalShares = pool.totalShares.plus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    if (event.params.to == PROTOCOL_FEE_COLLECTOR_ADDRESS) {
      // we collected fees in BPT with this mint
      const bptAddress = Address.fromString(pool.address.toHexString());
      let bptToken = getToken(bptAddress);
      let bptValueUSD = bptToken.latestUSDPrice;
      if (!bptValueUSD) {
        bptValueUSD = ZERO_BD;
        log.warning('BPT has $0 value for pool {}', [pool.address.toHex()]);
      }

      const collectedFeeBptAmount = tokenToDecimal(event.params.value, BPT_DECIMALS);
      let swapFeeBasedOnBpt = pool.accruedSwapFeesSinceLastFeeCollectionInBpt;
      let swapFeeBasedOnUSD = pool.accruedSwapFeesSinceLastFeeCollectionInUSD;
      const collectedFeeValue = collectedFeeBptAmount.times(bptValueUSD);

      //TODO: if there is no yield fee but the price of the bpt is higher now than at the time of the swap,
      // a yield fee will still be added because collectedFeeBptAmount > swapFeeBptAmount
      //(swapFeeBptAmount is calculated based on bptValue at the time of the swap)
      // is this true? at the time of swap, didn't the pool accumulate the surplus of bpt?

      // check if this pool collects yield fee
      let poolCollectsYieldFee = false;
      if (pool.poolType === PoolType.MetaStable || pool.poolType === PoolType.ComposableStable) {
        log.warning('Possible this pool collects yield fee: {}', [pool.address.toHex()]);
        let tokenAddresses = pool.tokensList;
        for (let i: i32 = 0; i < tokenAddresses.length; i++) {
          let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
          let poolToken = loadPoolToken(poolId.toHex(), tokenAddress);
          if (poolToken == null) {
            throw new Error('poolToken not found');
          }
          log.warning('Pooltoken {}: priceRate: {} , isExempt: {}', [
            poolToken.address,
            poolToken.priceRate.toString(),
            poolToken.isExemptFromYieldProtocolFee.toString(),
          ]);
          if (poolToken.priceRate.gt(ONE_BD) && !poolToken.isExemptFromYieldProtocolFee) {
            poolCollectsYieldFee = true;
          }
        }
      }

      if (poolCollectsYieldFee) {
        log.error('pool collects yieldfee: {}', [pool.address.toHex()]);
        // pool collects yield fee
        // calc yield fee based on BPT
        let yieldFeeBptAmount = collectedFeeBptAmount.minus(swapFeeBasedOnBpt);
        if (yieldFeeBptAmount.lt(ZERO_BD)) {
          /* this will happen when the yield fee is smaller (or has no yield fee)
                than the price timing-discrepancy of the swap pricing and bpt pricing
                */
          log.error('swapFeeBPTs where higher than total collected BPTs in fee for pool {}. Not adding to yield fee.', [
            pool.address.toHex(),
          ]);
          swapFeeBasedOnBpt = collectedFeeBptAmount;
          yieldFeeBptAmount = ZERO_BD;
        }
        pool.totalYieldFeeFromBpt = pool.totalYieldFeeFromBpt.plus(yieldFeeBptAmount.times(bptValueUSD));

        let yieldFeeUSDAmount = collectedFeeValue.minus(swapFeeBasedOnUSD);
        if (yieldFeeUSDAmount.lt(ZERO_BD)) {
          /* this will happen when the yield fee is smaller (or has no yield fee)
                than the price timing-discrepancy of the swap pricing and bpt pricing
                */
          log.error(
            'swapFeeBasedOnUSD where higher than total collected BPTs in fee for pool {}. Not adding to yield fee.',
            [pool.address.toHex()]
          );
          yieldFeeUSDAmount = ZERO_BD;
        }
        pool.totalYieldFeeFromUSD = pool.totalYieldFeeFromUSD.plus(yieldFeeUSDAmount);
      } else {
        log.error('pool does not collect yieldfee: {}', [pool.address.toHex()]);
      }

      pool.totalFeesBasedOnBpt = pool.totalFeesBasedOnBpt.plus(collectedFeeValue);
      pool.totalSwapFeeFromBpt = pool.totalSwapFeeFromBpt.plus(swapFeeBasedOnBpt.times(bptValueUSD));
      pool.totalSwapFeeFromUSD = pool.totalSwapFeeFromUSD.plus(swapFeeBasedOnUSD);
      pool.accruedSwapFeesSinceLastFeeCollectionInBpt = ZERO_BD;
      pool.accruedSwapFeesSinceLastFeeCollectionInUSD = ZERO_BD;
    }
  } else if (isBurn) {
    poolShareFrom.balance = poolShareFrom.balance.minus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolShareFrom.save();
    pool.totalShares = pool.totalShares.minus(tokenToDecimal(event.params.value, BPT_DECIMALS));
  } else {
    poolShareTo.balance = poolShareTo.balance.plus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolShareTo.save();

    poolShareFrom.balance = poolShareFrom.balance.minus(tokenToDecimal(event.params.value, BPT_DECIMALS));
    poolShareFrom.save();
  }

  if (poolShareTo !== null && poolShareTo.balance.notEqual(ZERO_BD) && poolShareToBalance.equals(ZERO_BD)) {
    pool.holdersCount = pool.holdersCount.plus(BigInt.fromI32(1));
  }

  if (poolShareFrom !== null && poolShareFrom.balance.equals(ZERO_BD) && poolShareFromBalance.notEqual(ZERO_BD)) {
    pool.holdersCount = pool.holdersCount.minus(BigInt.fromI32(1));
  }

  pool.save();
}

/************************************
 ************* FXPOOL ***************
 ************************************/

export function handleParametersSet(event: ParametersSet): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);

  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let pool = Pool.load(poolId.toHexString()) as Pool;

  pool.alpha = scaleDown(event.params.alpha, 18);
  pool.beta = scaleDown(event.params.beta, 18);
  pool.delta = scaleDown(event.params.delta, 18);
  pool.epsilon = scaleDown(event.params.epsilon, 18);
  pool.lambda = scaleDown(event.params.lambda, 18);

  pool.save();
}

export function handleAssimilatorIncluded(event: AssimilatorIncluded): void {
  let poolAddress = event.address;

  // TODO - refactor so pool -> poolId doesn't require call
  let poolContract = WeightedPool.bind(poolAddress);

  let poolIdCall = poolContract.try_getPoolId();
  let poolId = poolIdCall.value;

  let tokenAddress = event.params.reserve;
  let poolToken = loadPoolToken(poolId.toHexString(), tokenAddress);
  if (poolToken == null) return;

  poolToken.assimilator = event.params.assimilator;
  poolToken.save();
}
