import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts';
import {
  InternalBalanceChanged,
  PoolBalanceChanged,
  PoolBalanceManaged,
  Swap as SwapEvent,
} from '../types/Vault/Vault';
import {
  GradualWeightUpdate,
  Pool,
  PoolExit,
  PoolJoin,
  PoolShares,
  Swap,
  SwapConfig,
  UserInternalBalance,
} from '../types/schema';
import { scaleDown, tokenToDecimal } from './helpers/misc';
import { updatePoolWeights } from './helpers/weighted';
import {
  getPreferentialPricingAsset,
  isPricingAsset,
  swapValueInUSD,
  updatePoolLiquidity,
  valueInUSD,
} from './pricing';
import { MIN_VIABLE_LIQUIDITY, ONE_BD, ZERO, ZERO_BD } from './helpers/constants';
import { isStableLikePool, isVariableWeightPool, PoolType } from './helpers/pools';
import { updateAmpFactor } from './helpers/stable';
import { getOrCreateUser } from '../entities/user';
import { loadExistingToken } from '../entities/token';
import {
  getDailyVaultMetricAtDay,
  getOrCreateDailyVaultMetric,
  getOrCreateDailyVaultToken,
  getOrCreateLifetimeVaultMetric,
} from '../entities/vault-metrics';
import { loadExistingPoolToken } from '../entities/pool-token';
import { loadExistingTokenWeight } from '../entities/token-weight';
import { getOrCreateHourlyTokenPrice, getOrCreateTokenPrice } from '../entities/token-price';
import {
  getDailyPoolMetricAtDay,
  getOrCreateDailyPoolMetrics,
  getOrCreateDailyPoolToken,
  getOrCreateLifetimePoolMetrics,
} from '../entities/pool-metrics';
import { getOrCreateVaultToken } from '../entities/vault-token';

/************************************
 ******** INTERNAL BALANCES *********
 ************************************/

export function handleInternalBalanceChange(event: InternalBalanceChanged): void {
  // const user = getOrCreateUser(event.params.user);
  // const token = loadExistingToken(event.params.token);
  // let balanceId = user.address.concat(token.id);
  // //
  // let userBalance = UserInternalBalance.load(balanceId);
  // if (userBalance == null) {
  //   userBalance = new UserInternalBalance(balanceId);
  //
  //   userBalance.user = user.id;
  //   userBalance.userAddress = user.address;
  //   userBalance.token = token.id;
  //   userBalance.tokenAddress = token.address;
  //   userBalance.balance = ZERO_BD;
  // }
  //
  // let transferAmount = tokenToDecimal(event.params.delta, token.decimals);
  // userBalance.balance = userBalance.balance.plus(transferAmount);
  //
  // userBalance.save();
}

/************************************
 ****** DEPOSITS & WITHDRAWALS ******
 ************************************/

export function handleBalanceChange(event: PoolBalanceChanged): void {
  let amounts: BigInt[] = event.params.deltas;

  if (amounts.length === 0) {
    return;
  }
  let total: BigInt = amounts.reduce<BigInt>((sum, amount) => sum.plus(amount), new BigInt(0));
  if (total.gt(ZERO)) {
    const pool = Pool.load(event.params.poolId);
    if (pool == null) {
      log.warning('Pool not found in handlePoolJoined: {} {}', [
        event.params.poolId.toHexString(),
        event.transaction.hash.toHexString(),
      ]);
      return;
    }
    handlePoolJoined(
      event,
      event.params.poolId,
      event.params.deltas,
      event.params.liquidityProvider,
      pool.poolType === PoolType.StablePhantom
    );
  } else {
    handlePoolExited(event, event.params.poolId, event.params.deltas, event.params.liquidityProvider);
  }
}

function handlePoolJoined(
  event: ethereum.Event,
  poolId: Bytes,
  amounts: BigInt[],
  liquidityProvider: Address,
  initialStablePhantomJoin: boolean = false
): void {
  const pool = Pool.load(poolId);
  if (pool == null) {
    log.warning('Pool not found in handlePoolJoined: {} {}', [
      poolId.toHexString(),
      event.transaction.hash.toHexString(),
    ]);
    return;
  }
  const user = getOrCreateUser(liquidityProvider);

  let tokenAddresses = pool.tokenAddresses;
  let joinAmounts = new Array<BigDecimal>(tokenAddresses.length);
  let joinAmountUSD = BigDecimal.zero();
  for (let i: i32 = 0; i < tokenAddresses.length; i++) {
    const tokenAddress: Address = Address.fromBytes(tokenAddresses[i]);
    const poolToken = loadExistingPoolToken(pool.id, tokenAddress);
    const vaultToken = getOrCreateVaultToken(tokenAddress);
    const token = loadExistingToken(tokenAddress);

    let tokenAmountIn = tokenToDecimal(amounts[i], token.decimals);
    joinAmounts[i] = tokenAmountIn;
    let newAmount = poolToken.balance.plus(tokenAmountIn);
    joinAmountUSD = joinAmountUSD.plus(valueInUSD(tokenAmountIn, tokenAddress));

    vaultToken.balance = vaultToken.balance.plus(tokenAmountIn);
    vaultToken.save();

    poolToken.balance = newAmount;
    poolToken.save();
  }
  const join = new PoolJoin(event.transaction.hash.toHexString().concat(event.logIndex.toString()));
  join.sender = liquidityProvider;
  join.pool = pool.id;
  join.poolId = pool.id;
  join.tokenAddresses = pool.tokenAddresses;
  join.amounts = joinAmounts;
  join.user = user.id;
  join.userAddress = user.address;
  join.timestamp = event.block.timestamp.toI32();
  join.valueUSD = joinAmountUSD;
  join.tx = event.transaction.hash;
  join.save();

  // we only update the pool liquidity if one of the tokens is a pricing asset
  for (let i: i32 = 0; i < tokenAddresses.length; i++) {
    let tokenAddress: Address = Address.fromBytes(tokenAddresses[i]);
    if (isPricingAsset(tokenAddress)) {
      let success = updatePoolLiquidity(poolId, tokenAddress, event.block);
      // Some pricing assets may not have a route back to USD yet
      // so we keep trying until we find one
      if (success) {
        break;
      }
    }
  }

  // Update virtual supply
  if (pool.poolType == 'StablePhantom' && initialStablePhantomJoin) {
    let maxTokenBalance = BigDecimal.fromString('5192296858534827.628530496329220095');
    const poolShares = PoolShares.load(pool.id) as PoolShares;
    if (poolShares.balance.equals(maxTokenBalance)) {
      let initialBpt = ZERO_BD;
      for (let i: i32 = 0; i < tokenAddresses.length; i++) {
        if (tokenAddresses[i] == pool.address) {
          initialBpt = scaleDown(amounts[i], 18);
        }
      }
      poolShares.balance = maxTokenBalance.minus(initialBpt);
      poolShares.save();
    }
  }
}

function handlePoolExited(event: ethereum.Event, poolId: Bytes, amounts: BigInt[], liquidityProvider: Address): void {
  const pool = Pool.load(poolId);
  if (pool == null) {
    log.warning('Pool not found in handlePoolExited: {} {}', [
      poolId.toHexString(),
      event.transaction.hash.toHexString(),
    ]);
    return;
  }

  const user = getOrCreateUser(liquidityProvider);

  const tokenAddresses = pool.tokenAddresses;
  let exitAmounts = new Array<BigDecimal>(tokenAddresses.length);
  let exitAmountUSD = BigDecimal.zero();

  for (let i: i32 = 0; i < tokenAddresses.length; i++) {
    let tokenAddress: Address = Address.fromBytes(tokenAddresses[i]);

    const poolToken = loadExistingPoolToken(poolId, tokenAddress);
    const vaultToken = getOrCreateVaultToken(tokenAddress);
    const dailyVaultToken = getOrCreateDailyVaultToken(tokenAddress, event.block);
    const dailyPoolToken = getOrCreateDailyPoolToken(poolId, tokenAddress, event.block);
    const token = loadExistingToken(tokenAddress);

    // adding initial liquidity
    let tokenAmountOut = tokenToDecimal(amounts[i].neg(), token.decimals);
    let newAmount = poolToken.balance.minus(tokenAmountOut);
    exitAmounts[i] = tokenAmountOut;
    exitAmountUSD = exitAmountUSD.plus(valueInUSD(tokenAmountOut, tokenAddress));

    // todo exit

    poolToken.balance = newAmount;
    poolToken.save();

    vaultToken.balance = vaultToken.balance.minus(tokenAmountOut);
    vaultToken.save();

    dailyVaultToken.totalBalance = vaultToken.balance;
    dailyVaultToken.balanceChange24h = dailyVaultToken.balanceChange24h.plus(tokenAmountOut);
    dailyVaultToken.save();

    dailyPoolToken.totalBalance = poolToken.balance;
    dailyPoolToken.balanceChange24h = dailyPoolToken.balanceChange24h.plus(tokenAmountOut);
    dailyPoolToken.save();
  }
  // log.warning('Pool exited: {} {} {}', [
  //   poolId.toHexString(),
  //   event.params.liquidityProvider.toHexString(),
  //   exitAmounts.toString(),
  // ]);
  const exit = new PoolExit(event.transaction.hash.toHexString().concat(event.logIndex.toString()));
  exit.pool = pool.id;
  exit.poolId = pool.id;
  exit.tokenAddresses = pool.tokenAddresses;
  exit.amounts = exitAmounts;
  exit.user = user.id;
  exit.userAddress = user.address;
  exit.timestamp = event.block.timestamp.toI32();
  exit.valueUSD = exitAmountUSD;
  exit.sender = liquidityProvider;
  exit.tx = event.transaction.hash;
  exit.save();

  for (let i: i32 = 0; i < tokenAddresses.length; i++) {
    let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
    if (isPricingAsset(tokenAddress)) {
      let success = updatePoolLiquidity(poolId, tokenAddress, event.block);
      // Some pricing assets may not have a route back to USD yet
      // so we keep trying until we find one
      if (success) {
        break;
      }
    }
  }
}

/************************************
 ********** INVESTMENTS *************
 ************************************/
export function handleBalanceManage(event: PoolBalanceManaged): void {
  // let poolId = event.params.poolId;
  // let pool = Pool.load(poolId.toHex());
  // if (pool == null) {
  //   log.warning('Pool not found in handleBalanceManage: {}', [poolId.toHexString()]);
  //   return;
  // }
  //
  // let token: Address = event.params.token;
  // let assetManagerAddress: Address = event.params.assetManager;
  //
  // //let cashDelta = event.params.cashDelta;
  // let managedDelta = event.params.managedDelta;
  //
  // let poolToken = loadPoolToken(poolId.toHexString(), token);
  // if (poolToken == null) {
  //   throw new Error('poolToken not found');
  // }
  //
  // let managedDeltaAmount = tokenToDecimal(managedDelta, poolToken.decimals);
  //
  // poolToken.invested = poolToken.invested.plus(managedDeltaAmount);
  // poolToken.save();
  //
  // let assetManagerId = poolToken.id.concat(assetManagerAddress.toHexString());
  //
  // let investment = new Investment(assetManagerId);
  // investment.assetManagerAddress = assetManagerAddress;
  // investment.poolTokenId = poolToken.id;
  // investment.amount = managedDeltaAmount;
  // investment.timestamp = event.block.timestamp.toI32();
  // investment.save();
}

/************************************
 ************** SWAPS ***************
 ************************************/
export function handleSwapEvent(event: SwapEvent): void {
  // its possible for 0 amounts given unsupported tokens, see TX: https://ftmscan.com/tx/0x74f1827d45054e794d08ff27fb6205e073fe0a8e600c4415fa03f98bf7deb2c2#eventlog
  if (event.params.amountIn.equals(BigInt.zero()) || event.params.amountOut.equals(BigInt.zero())) {
    log.warning('Token amount 0 in swap event: Pool: {}, amountIn {},  amountOut {}', [
      event.params.poolId.toHexString(),
      event.params.amountIn.toString(),
      event.params.amountOut.toString(),
    ]);
    return;
  }

  let blockTimestamp = event.block.timestamp.toI32();
  let poolId = event.params.poolId;

  let pool = Pool.load(poolId);
  if (pool == null) {
    log.warning('Pool not found in handleSwapEvent: {}', [poolId.toHexString()]);
    return;
  }

  let poolAddress = pool.address;
  let tokenInAddress: Address = event.params.tokenIn;
  let tokenOutAddress: Address = event.params.tokenOut;

  const user = getOrCreateUser(event.transaction.from);

  if (isVariableWeightPool(pool)) {
    // Some pools' weights update over time so we need to update them after each swap
    const update = GradualWeightUpdate.load(poolId);
    // todo: we could calculate the amp instead of getting in on chain
    // we give one week grace period in case nobody swaps for a week after the am update ended
    if (update !== null && update.startTimestamp <= blockTimestamp && update.endTimestamp + 604800 >= blockTimestamp) {
      updatePoolWeights(poolId);
    }
  } else if (isStableLikePool(pool)) {
    const update = GradualWeightUpdate.load(poolId);
    // we give one week grace period in case nobody swaps for a week after the am update ended
    if (update !== null && update.startTimestamp <= blockTimestamp && update.endTimestamp + 604800 >= blockTimestamp) {
      updateAmpFactor(pool);
    }
  }

  const lifetimePoolMetric = getOrCreateLifetimePoolMetrics(poolId, event.block);
  const dailyVaultTokenIn = getOrCreateDailyVaultToken(tokenInAddress, event.block);
  const dailyVaultTokenOut = getOrCreateDailyVaultToken(tokenOutAddress, event.block);
  const dailyPoolTokenIn = getOrCreateDailyPoolToken(poolId, tokenInAddress, event.block);
  const dailyPoolTokenOut = getOrCreateDailyPoolToken(poolId, tokenOutAddress, event.block);

  const inToken = loadExistingToken(tokenInAddress);
  const outToken = loadExistingToken(tokenOutAddress);
  let tokenAmountIn: BigDecimal = scaleDown(event.params.amountIn, inToken.decimals);
  let tokenAmountOut: BigDecimal = scaleDown(event.params.amountOut, outToken.decimals);
  // Capture price
  const tokenOutPrice = getOrCreateTokenPrice(tokenOutAddress, tokenInAddress, event.block);
  const tokenInPrice = getOrCreateTokenPrice(tokenInAddress, tokenOutAddress, event.block);
  if (isPricingAsset(tokenInAddress) && lifetimePoolMetric.totalLiquidity.gt(MIN_VIABLE_LIQUIDITY)) {
    // todo: do we need TokenPrice or can we just use latest price?
    tokenOutPrice.amount = tokenAmountIn;

    if (pool.poolType === PoolType.Weighted) {
      // As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
      // based on the pool's weights and updated balances after the swap.
      let tokenInWeight = loadExistingTokenWeight(poolId, tokenInAddress).weight;
      let tokenOutWeight = loadExistingTokenWeight(poolId, tokenOutAddress).weight;
      if (tokenInWeight.equals(BigDecimal.zero()) || tokenOutWeight.equals(BigDecimal.zero())) {
        log.warning('TokenInWeight is zero, {} {} {}', [
          poolId.toHexString(),
          tokenInWeight.toString(),
          tokenOutWeight.toString(),
        ]);
        tokenInWeight = ONE_BD;
        tokenOutWeight = ONE_BD;
      }
      tokenOutPrice.price = tokenAmountIn.div(tokenInWeight).div(tokenAmountOut.div(tokenOutWeight));
    } else {
      // Otherwise we can get a simple measure of the price from the ratio of amount in vs amount out
      tokenOutPrice.price = tokenAmountIn.div(tokenAmountOut);
    }
    tokenOutPrice.priceUSD = valueInUSD(tokenOutPrice.price, tokenInAddress);
    tokenOutPrice.timestamp = event.block.timestamp.toI32();
    tokenOutPrice.block = event.block.number;
    tokenOutPrice.save();
  }
  if (isPricingAsset(tokenOutAddress) && lifetimePoolMetric.totalLiquidity.gt(MIN_VIABLE_LIQUIDITY)) {
    //tokenPrice.poolTokenId = getPoolTokenId(poolId, tokenInAddress);
    tokenInPrice.amount = tokenAmountOut;
    if (pool.poolType === PoolType.Weighted) {
      let tokenInWeight = loadExistingTokenWeight(poolId, tokenInAddress).weight;
      let tokenOutWeight = loadExistingTokenWeight(poolId, tokenOutAddress).weight;
      if (tokenInWeight.equals(BigDecimal.zero()) || tokenOutWeight.equals(BigDecimal.zero())) {
        tokenInWeight = ONE_BD;
        tokenOutWeight = ONE_BD;
      }
      // As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
      // based on the pool's weights and updated balances after the swap.
      tokenInPrice.price = tokenAmountOut.div(tokenOutWeight).div(tokenAmountIn.div(tokenInWeight));
      tokenInPrice.save();
    } else {
      // Otherwise we can get a simple measure of the price from the ratio of amount out vs amount in
      tokenInPrice.price = tokenAmountOut.div(tokenAmountIn);
    }
    tokenInPrice.priceUSD = valueInUSD(tokenInPrice.price, tokenOutAddress);
    tokenInPrice.timestamp = event.block.timestamp.toI32();
    tokenInPrice.block = event.block.number;
    tokenInPrice.save();
  }

  const hourlyTokenOutPrice = getOrCreateHourlyTokenPrice(tokenOutAddress, event.block);
  hourlyTokenOutPrice.endPriceUSD = tokenOutPrice.priceUSD;
  hourlyTokenOutPrice.avgPriceUSD = hourlyTokenOutPrice.avgPriceUSD
    .times(hourlyTokenOutPrice.dataPoints)
    .plus(tokenOutPrice.priceUSD)
    .div(hourlyTokenOutPrice.dataPoints.plus(ONE_BD));
  hourlyTokenOutPrice.dataPoints = hourlyTokenOutPrice.dataPoints.plus(ONE_BD);
  hourlyTokenOutPrice.dailyPoolToken = dailyPoolTokenOut.id;
  hourlyTokenOutPrice.dailyVaultToken = dailyVaultTokenOut.id;
  hourlyTokenOutPrice.save();

  const hourlyTokenInPrice = getOrCreateHourlyTokenPrice(tokenInAddress, event.block);
  hourlyTokenInPrice.endPriceUSD = tokenInPrice.priceUSD;
  hourlyTokenInPrice.avgPriceUSD = hourlyTokenInPrice.avgPriceUSD
    .times(hourlyTokenInPrice.dataPoints)
    .plus(tokenInPrice.priceUSD)
    .div(hourlyTokenInPrice.dataPoints.plus(ONE_BD));
  hourlyTokenInPrice.dataPoints = hourlyTokenInPrice.dataPoints.plus(ONE_BD);
  hourlyTokenInPrice.dailyPoolToken = dailyPoolTokenIn.id;
  hourlyTokenInPrice.dailyVaultToken = dailyVaultTokenIn.id;
  hourlyTokenInPrice.save();

  // check if its a swap or a join / exit on a phantom pool
  if (tokenInAddress === pool.address) {
    handlePoolExited(event, pool.id, [event.params.amountIn], event.transaction.from);
    return;
  }
  if (tokenOutAddress === pool.address) {
    handlePoolJoined(event, pool.id, [event.params.amountOut], event.transaction.from);
    return;
  }

  const swapConfig = SwapConfig.load(poolId) as SwapConfig;
  const swapValueUSD = swapValueInUSD(tokenInAddress, tokenAmountIn, tokenOutAddress, tokenAmountOut);
  const swapFeesUSD = swapValueUSD.times(swapConfig.fee);

  lifetimePoolMetric.swapCount = lifetimePoolMetric.swapCount.plus(BigInt.fromI32(1));
  lifetimePoolMetric.totalSwapVolume = lifetimePoolMetric.totalSwapVolume.plus(swapValueUSD);
  lifetimePoolMetric.totalSwapFee = lifetimePoolMetric.totalSwapFee.plus(swapFeesUSD);
  lifetimePoolMetric.save();

  const dailyPoolMetric = getOrCreateDailyPoolMetrics(poolId, event.block);
  const yesterdaysPoolMetric = getDailyPoolMetricAtDay(poolId, dailyPoolMetric.day - 1);
  dailyPoolMetric.swapCount24h = dailyPoolMetric.swapCount24h.plus(BigInt.fromI32(1));
  dailyPoolMetric.totalSwapCount = lifetimePoolMetric.swapCount;
  dailyPoolMetric.swapVolume24h = dailyPoolMetric.swapVolume24h.plus(swapValueUSD);
  dailyPoolMetric.totalSwapVolume = lifetimePoolMetric.totalSwapVolume;
  dailyPoolMetric.swapFee24h = dailyPoolMetric.swapFee24h.plus(swapFeesUSD);
  dailyPoolMetric.totalSwapFee = lifetimePoolMetric.totalSwapFee;

  if (yesterdaysPoolMetric !== null) {
    dailyPoolMetric.swapCountChange24h = dailyPoolMetric.swapCount24h.minus(yesterdaysPoolMetric.swapCount24h);
    dailyPoolMetric.swapVolumeChange24h = dailyPoolMetric.swapVolume24h.minus(yesterdaysPoolMetric.swapVolume24h);
    dailyPoolMetric.swapFeeChange24h = dailyPoolMetric.swapFee24h.minus(yesterdaysPoolMetric.swapFee24h);
  }
  dailyPoolMetric.save();

  let lifetimeVaultMetricVaultMetric = getOrCreateLifetimeVaultMetric(event.block);
  lifetimeVaultMetricVaultMetric.totalSwapVolume = lifetimeVaultMetricVaultMetric.totalSwapVolume.plus(swapValueUSD);
  lifetimeVaultMetricVaultMetric.totalSwapFee = lifetimeVaultMetricVaultMetric.totalSwapFee.plus(swapFeesUSD);
  lifetimeVaultMetricVaultMetric.swapCount = lifetimeVaultMetricVaultMetric.swapCount.plus(BigInt.fromI32(1));
  lifetimeVaultMetricVaultMetric.save();

  const dailyVaultMetric = getOrCreateDailyVaultMetric(event.block);
  const yesterdaysVaultMetric = getDailyVaultMetricAtDay(dailyVaultMetric.day - 1);
  dailyVaultMetric.totalSwapVolume = lifetimeVaultMetricVaultMetric.totalSwapVolume;
  dailyVaultMetric.swapVolume24h = dailyVaultMetric.swapVolume24h.plus(swapValueUSD);
  dailyVaultMetric.totalSwapFee = lifetimeVaultMetricVaultMetric.totalSwapFee;
  dailyVaultMetric.swapFee24h = dailyVaultMetric.swapFee24h.plus(swapFeesUSD);
  dailyVaultMetric.swapCount24h = dailyVaultMetric.swapCount24h.plus(BigInt.fromI32(1));
  dailyVaultMetric.totalSwapCount = lifetimeVaultMetricVaultMetric.swapCount;

  if (yesterdaysVaultMetric !== null) {
    dailyVaultMetric.swapVolumeChange24h = dailyVaultMetric.swapVolume24h.minus(yesterdaysVaultMetric.swapVolume24h);
    dailyVaultMetric.swapFeeChange24h = dailyVaultMetric.swapFee24h.minus(yesterdaysVaultMetric.swapFee24h);
    dailyVaultMetric.swapCountChange24h = dailyVaultMetric.swapCount24h.minus(yesterdaysVaultMetric.swapCount24h);
  }

  dailyVaultMetric.save();

  const poolTokenIn = loadExistingPoolToken(poolId, tokenInAddress);
  const poolTokenOut = loadExistingPoolToken(poolId, tokenOutAddress);

  if (poolTokenIn === null || poolTokenOut === null) {
    log.error('Pool token not found handleSwapEvent , poolId: {}, tokenIn: {}, tokenOut: {}', [
      poolId.toHexString(),
      tokenInAddress.toHexString(),
      tokenOutAddress.toHexString(),
    ]);
    return;
  }
  poolTokenIn.balance = poolTokenIn.balance.plus(tokenAmountIn);
  poolTokenIn.swapCount = poolTokenIn.swapCount.plus(BigInt.fromI32(1));
  poolTokenIn.save();

  poolTokenOut.balance = poolTokenOut.balance.minus(tokenAmountOut);
  poolTokenOut.swapCount = poolTokenOut.swapCount.plus(BigInt.fromI32(1));
  poolTokenOut.save();

  const vaultTokenIn = getOrCreateVaultToken(tokenInAddress);
  vaultTokenIn.balance = vaultTokenIn.balance.plus(tokenAmountIn);
  vaultTokenIn.swapCount = vaultTokenIn.swapCount.plus(BigInt.fromI32(1));
  vaultTokenIn.save();

  const vaultTokenOut = getOrCreateVaultToken(tokenOutAddress);
  vaultTokenOut.balance = vaultTokenOut.balance.minus(tokenAmountOut);
  vaultTokenIn.swapCount = vaultTokenOut.swapCount.plus(BigInt.fromI32(1));
  vaultTokenOut.save();

  dailyVaultTokenIn.totalBalance = vaultTokenIn.balance;
  dailyVaultTokenIn.balanceChange24h = dailyVaultTokenIn.balanceChange24h.plus(tokenAmountIn);
  dailyVaultTokenIn.save();

  dailyVaultTokenOut.totalBalance = vaultTokenOut.balance;
  dailyVaultTokenOut.balanceChange24h = dailyVaultTokenOut.balanceChange24h.minus(tokenAmountOut);
  dailyVaultTokenOut.save();

  dailyPoolTokenIn.totalBalance = poolTokenIn.balance;
  dailyPoolTokenIn.balanceChange24h = dailyPoolTokenIn.balanceChange24h.plus(tokenAmountIn);
  dailyPoolTokenIn.save();

  dailyPoolTokenOut.totalBalance = poolTokenOut.balance;
  dailyPoolTokenOut.balanceChange24h = dailyPoolTokenOut.balanceChange24h.minus(tokenAmountOut);
  dailyPoolTokenOut.save();

  const preferentialToken = getPreferentialPricingAsset([tokenInAddress, tokenOutAddress]);
  if (preferentialToken != Address.zero()) {
    updatePoolLiquidity(poolId, preferentialToken, event.block);
  }

  const swap = new Swap(event.transaction.hash.toHexString().concat(event.logIndex.toString()));
  swap.poolId = poolId;
  swap.pool = poolId;
  swap.tokenIn = tokenInAddress;
  swap.tokenInAddress = tokenInAddress;
  swap.tokenOut = tokenOutAddress;
  swap.tokenOutAddress = tokenOutAddress;
  swap.amountIn = tokenAmountIn;
  swap.amountOut = tokenAmountOut;
  swap.valueUSD = swapValueUSD;

  swap.sender = event.transaction.from;
  swap.userAddress = user.address;
  swap.user = user.id;

  swap.timestamp = blockTimestamp;
  swap.tx = event.transaction.hash;
  swap.save();
}
