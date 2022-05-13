import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts';
import {
  InternalBalanceChanged,
  PoolBalanceChanged,
  PoolBalanceManaged,
  Swap as SwapEvent,
} from '../types/Vault/Vault';
import { GradualWeightUpdate, Pool, PoolExit, PoolJoin, PoolShares, Swap, SwapConfig } from '../types/schema';
import { scaleDown, tokenToDecimal } from './helpers/misc';
import { updatePoolWeights } from './helpers/weighted';
import { isPricingAsset, swapValueInUSD, updatePoolLiquidity, valueInUSD } from './pricing';
import { MIN_VIABLE_LIQUIDITY, ONE_BD, ZERO, ZERO_BD } from './helpers/constants';
import { isStableLikePool, isVariableWeightPool, PoolType } from './helpers/pools';
import { updateAmpFactor } from './helpers/stable';
import { getOrCreateUser } from '../entities/user';
import { loadExistingToken } from '../entities/token';
import { getOrCreateGlobalVaultMetric } from '../entities/vault-metrics';
import { loadExistingPoolToken } from '../entities/pool-token';
import { getTokenWeight } from '../entities/token-weight';
import { getOrCreateTokenPrice } from '../entities/token-price';
import { getOrCreateGlobalPoolMetrics } from '../entities/pool-metrics';
import { getOrCreateVaultToken } from '../entities/vault-token';

/************************************
 ******** INTERNAL BALANCES *********
 ************************************/

export function handleInternalBalanceChange(event: InternalBalanceChanged): void {
  // createUserEntity(event.params.user);
  //
  // let userAddress = event.params.user.toHexString();
  // let token = event.params.token;
  // let balanceId = userAddress.concat(token.toHexString());
  //
  // let userBalance = UserInternalBalance.load(balanceId);
  // if (userBalance == null) {
  //   userBalance = new UserInternalBalance(balanceId);
  //
  //   userBalance.userAddress = userAddress;
  //   userBalance.token = token;
  //   userBalance.balance = ZERO_BD;
  // }
  //
  // let transferAmount = tokenToDecimal(event.params.delta, getTokenDecimals(token));
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
    handlePoolJoined(event, event.params.poolId, event.params.deltas, event.params.liquidityProvider);
  } else {
    handlePoolExited(event);
  }
}

function handlePoolJoined(event: ethereum.Event, poolId: Bytes, amounts: BigInt[], liquidityProvider: Address): void {
  // let poolId: string = event.params.poolId.toHexString();
  // let amounts: BigInt[] = event.params.deltas;
  // let blockTimestamp = event.block.timestamp.toI32();
  // let logIndex = event.logIndex;
  // let transactionHash = event.transaction.hash;
  //
  // let pool = Pool.load(poolId);
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

    // updateTokenBalances(tokenAddress, tokenAmountIn, TokenBalanceEvent.JOIN, event);
  }
  // log.warning('Pool joined: {} {} {}', [
  //   pool.id.toHexString(),
  //   event.params.liquidityProvider.toHexString(),
  //   joinAmounts.toString(),
  // ]);
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

  // todo: ?
  // Update virtual supply
  if (pool.poolType == 'StablePhantom') {
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
  // let poolId = event.params.poolId;
  // let amounts = event.params.deltas;
  // let blockTimestamp = event.block.timestamp.toI32();
  // let logIndex = event.logIndex;
  // let transactionHash = event.transaction.hash;
  //
  // let pool = Pool.load(poolId);
  // if (pool == null) {
  //   log.warning('Pool not found in handlePoolExited: {} {}', [poolId.toHexString(), transactionHash.toHexString()]);
  //   return;
  // }
  // let tokenAddresses = pool.tokensList;
  //
  // let exitAmounts = new Array<BigDecimal>(tokenAddresses.length);
  // for (let i: i32 = 0; i < exitAmounts.length; i++) {
  //   let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
  //   let poolToken = loadBalancerPoolToken(poolId, tokenAddress);
  //   if (poolToken == null) {
  //     throw new Error('poolToken not found');
  //   }
  //   let exitAmount = scaleDown(amounts[i].neg(), poolToken.decimals);
  //   exitAmounts[i] = exitAmount;
  // }
  //
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
  let joinAmountUSD = BigDecimal.zero();

  for (let i: i32 = 0; i < tokenAddresses.length; i++) {
    let tokenAddress: Address = Address.fromBytes(tokenAddresses[i]);

    const poolToken = loadExistingPoolToken(poolId, tokenAddress);
    const vaultToken = getOrCreateVaultToken(tokenAddress);
    const token = loadExistingToken(tokenAddress);

    // adding initial liquidity
    let tokenAmountOut = tokenToDecimal(amounts[i].neg(), token.decimals);
    let newAmount = poolToken.balance.minus(tokenAmountOut);
    exitAmounts[i] = tokenAmountOut;
    joinAmountUSD = joinAmountUSD.plus(valueInUSD(tokenAmountOut, tokenAddress));

    // todo exit

    vaultToken.balance = vaultToken.balance.minus(tokenAmountOut);
    vaultToken.save();

    poolToken.balance = newAmount;
    poolToken.save();
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
  exit.valueUSD = joinAmountUSD;
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

  // check if its a swap or a join / exit on a phantom pool
  if (pool.phantomPool && (tokenInAddress === pool.address || tokenOutAddress === pool.address)) {
    if (tokenInAddress === pool.address) {
      return handlePoolExited(event, pool.id, [event.params.amountIn], event.transaction.from);
    } else {
      return handlePoolJoined(event, pool.id, [event.params.amountOut], event.transaction.from);
    }
  }

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

  // Update virtual supply
  if (pool.phantomPool) {
    if (event.params.tokenIn == pool.address) {
      const sharesBalance = PoolShares.load(poolId) as PoolShares;
      sharesBalance.balance.minus(tokenToDecimal(event.params.amountIn, 18));
      sharesBalance.save();
    } else if (event.params.tokenOut == pool.address) {
      const sharesBalance = PoolShares.load(poolId) as PoolShares;
      sharesBalance.balance.plus(tokenToDecimal(event.params.amountOut, 18));
      sharesBalance.save();
    }
  }

  const inToken = loadExistingToken(tokenInAddress);
  const outToken = loadExistingToken(tokenOutAddress);
  let tokenAmountIn: BigDecimal = scaleDown(event.params.amountIn, inToken.decimals);
  let tokenAmountOut: BigDecimal = scaleDown(event.params.amountOut, outToken.decimals);

  let swapValueUSD = ZERO_BD;
  let swapFeesUSD = ZERO_BD;

  // if it was an actual swap, calculate the fee
  if (poolAddress != tokenInAddress && poolAddress != tokenOutAddress) {
    const swapConfig = SwapConfig.load(poolId) as SwapConfig;
    swapValueUSD = swapValueInUSD(tokenInAddress, tokenAmountIn, tokenOutAddress, tokenAmountOut);
    swapFeesUSD = swapValueUSD.times(swapConfig.fee);
  }

  // todo: store swaps
  // todo: if phantom pool => store join / exit

  // update pool swapsCount
  // let pool = Pool.load(poolId.toHex());
  const globalPoolMetric = getOrCreateGlobalPoolMetrics(poolId, event.block);
  globalPoolMetric.swapsCount = globalPoolMetric.swapsCount.plus(BigInt.fromI32(1));
  globalPoolMetric.totalSwapVolume = globalPoolMetric.totalSwapVolume.plus(swapValueUSD);
  globalPoolMetric.totalSwapFee = globalPoolMetric.totalSwapFee.plus(swapFeesUSD);
  globalPoolMetric.save();

  // update vault total swap volume
  let globalVaultMetric = getOrCreateGlobalVaultMetric(event.block);
  globalVaultMetric.totalSwapVolume = globalVaultMetric.totalSwapVolume.plus(swapValueUSD);
  globalVaultMetric.totalSwapFee = globalVaultMetric.totalSwapFee.plus(swapFeesUSD);
  globalVaultMetric.totalSwapCount = globalVaultMetric.totalSwapCount.plus(BigInt.fromI32(1));
  globalVaultMetric.save();

  // let vaultSnapshot = getBalancerSnapshot(globalVaultMetric.id, blockTimestamp);
  // vaultSnapshot.totalSwapVolume = globalVaultMetric.totalSwapVolume;
  // vaultSnapshot.totalSwapFee = globalVaultMetric.totalSwapFee;
  // vaultSnapshot.totalSwapCount = globalVaultMetric.totalSwapCount;
  // vaultSnapshot.save();

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

  // Capture price
  if (isPricingAsset(tokenInAddress) && globalPoolMetric.totalLiquidity.gt(MIN_VIABLE_LIQUIDITY)) {
    // todo: do we need TokenPrice or can we just use latest price?
    const tokenPrice = getOrCreateTokenPrice(tokenOutAddress, tokenInAddress, event.block);
    tokenPrice.amount = tokenAmountIn;

    if (pool.poolType === PoolType.Weighted) {
      // As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
      // based on the pool's weights and updated balances after the swap.
      let tokenInWeight = getTokenWeight(poolId, tokenInAddress).weight;
      let tokenOutWeight = getTokenWeight(poolId, tokenOutAddress).weight;
      if (tokenInWeight.equals(BigDecimal.zero()) || tokenOutWeight.equals(BigDecimal.zero())) {
        log.warning('TokenInWeight is zero, {} {} {}', [
          poolId.toHexString(),
          tokenInWeight.toString(),
          tokenOutWeight.toString(),
        ]);
        tokenInWeight = ONE_BD;
        tokenOutWeight = ONE_BD;
      }
      tokenPrice.price = poolTokenIn.balance.div(tokenInWeight).div(poolTokenOut.balance.div(tokenOutWeight));
    } else {
      // Otherwise we can get a simple measure of the price from the ratio of amount in vs amount out
      tokenPrice.price = tokenAmountIn.div(tokenAmountOut);
    }
    tokenPrice.priceUSD = valueInUSD(tokenPrice.price, tokenInAddress);
    tokenPrice.timestamp = event.block.timestamp.toI32();
    tokenPrice.block = event.block.number;
    tokenPrice.save();
    updatePoolLiquidity(poolId, tokenInAddress, event.block);
  }
  if (isPricingAsset(tokenOutAddress) && globalPoolMetric.totalLiquidity.gt(MIN_VIABLE_LIQUIDITY)) {
    const tokenPrice = getOrCreateTokenPrice(tokenInAddress, tokenOutAddress, event.block);
    //tokenPrice.poolTokenId = getPoolTokenId(poolId, tokenInAddress);
    tokenPrice.amount = tokenAmountOut;
    if (pool.poolType === PoolType.Weighted) {
      let tokenInWeight = getTokenWeight(poolId, tokenInAddress).weight;
      let tokenOutWeight = getTokenWeight(poolId, tokenOutAddress).weight;
      if (tokenInWeight.equals(BigDecimal.zero()) || tokenOutWeight.equals(BigDecimal.zero())) {
        tokenInWeight = ONE_BD;
        tokenOutWeight = ONE_BD;
      }
      // As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
      // based on the pool's weights and updated balances after the swap.
      tokenPrice.price = poolTokenOut.balance.div(tokenOutWeight).div(poolTokenIn.balance.div(tokenInWeight));
      tokenPrice.save();
    } else {
      // Otherwise we can get a simple measure of the price from the ratio of amount out vs amount in
      tokenPrice.price = tokenAmountOut.div(tokenAmountIn);
    }
    tokenPrice.priceUSD = valueInUSD(tokenPrice.price, tokenOutAddress);
    tokenPrice.timestamp = event.block.timestamp.toI32();
    tokenPrice.block = event.block.number;
    tokenPrice.save();

    updatePoolLiquidity(poolId, tokenOutAddress, event.block);
  }

  // check if its a swap or a join / exit on a phantom pool
  if (pool.phantomPool && (tokenInAddress === pool.address || tokenOutAddress === pool.address)) {
    if (tokenInAddress === pool.address) {
      const exit = new PoolExit(event.transaction.hash.toHexString().concat(event.logIndex.toString()));
      exit.pool = pool.id;
      exit.poolId = pool.id;
      exit.tokenAddresses = [tokenOutAddress];
      exit.amounts = [tokenAmountOut];
      exit.user = user.id;
      exit.userAddress = user.address;
      exit.timestamp = event.block.timestamp.toI32();
      exit.valueUSD = valueInUSD(tokenAmountOut, tokenOutAddress);
      exit.sender = user.address;
      exit.tx = event.transaction.hash;
      exit.save();
    } else {
      const join = new PoolJoin(event.transaction.hash.toHexString().concat(event.logIndex.toString()));
      join.pool = pool.id;
      join.poolId = pool.id;
      join.tokenAddresses = [tokenInAddress];
      join.amounts = [tokenAmountIn];
      join.user = user.id;
      join.userAddress = user.address;
      join.timestamp = event.block.timestamp.toI32();
      join.valueUSD = valueInUSD(tokenAmountIn, tokenInAddress);
      join.sender = user.address;
      join.tx = event.transaction.hash;
      join.save();
    }
  } else {
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
}
