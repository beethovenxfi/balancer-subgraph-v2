import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts';
import {
  InternalBalanceChanged,
  PoolBalanceChanged,
  PoolBalanceManaged,
  Swap as SwapEvent,
} from '../types/Vault/Vault';
import { GradualWeightUpdate, Pool, PoolShares, SwapConfig } from '../types/schema';
import { scaleDown, tokenToDecimal } from './helpers/misc';
import { updatePoolWeights } from './helpers/weighted';
import { isPricingAsset, swapValueInUSD, updatePoolLiquidity, valueInUSD } from './pricing';
import { MIN_VIABLE_LIQUIDITY, ZERO, ZERO_BD } from './helpers/constants';
import { hasVirtualSupply, isStableLikePool, isVariableWeightPool, PoolType } from './helpers/pools';
import { updateAmpFactor } from './helpers/stable';
import { getOrCreateUser } from '../entities/user';
import { getOrCreateToken } from '../entities/token';
import { getOrCreateGlobalVaultMetric } from '../entities/vault-metrics';
import { getPoolToken } from '../entities/pool-token';
import { getTokenWeight } from '../entities/token-weight';
import { createOrGetTokenPrice } from '../entities/token-price';
import { getOrCreateGlobalPoolMetrics } from '../entities/pool-metrics';

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
    handlePoolJoined(event);
  } else {
    handlePoolExited(event);
  }
}

function handlePoolJoined(event: PoolBalanceChanged): void {
  // let poolId: string = event.params.poolId.toHexString();
  let amounts: BigInt[] = event.params.deltas;
  // let blockTimestamp = event.block.timestamp.toI32();
  // let logIndex = event.logIndex;
  // let transactionHash = event.transaction.hash;
  //
  // let pool = Pool.load(poolId);
  const pool = Pool.load(event.params.poolId);
  if (pool == null) {
    log.warning('Pool not found in handlePoolJoined: {} {}', [
      event.params.poolId.toHexString(),
      event.transaction.hash.toHexString(),
    ]);
    return;
  }
  // let tokenAddresses = pool.tokensList;
  //
  // let joinId = transactionHash.toHexString().concat(logIndex.toString());
  // let join = new JoinExit(joinId);
  // join.sender = event.params.liquidityProvider;
  // let joinAmounts = new Array<BigDecimal>(tokenAddresses.length);
  // for (let i: i32 = 0; i < joinAmounts.length; i++) {
  //   let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
  //   let poolToken = loadPoolToken(poolId, tokenAddress);
  //   if (poolToken == null) {
  //     throw new Error('poolToken not found');
  //   }
  //   let joinAmount = scaleDown(amounts[i], poolToken.decimals);
  //   joinAmounts[i] = joinAmount;
  // }
  // join.type = 'Join';
  // join.amounts = joinAmounts;
  // join.pool = event.params.poolId.toHexString();
  // join.user = event.params.liquidityProvider.toHexString();
  // join.timestamp = blockTimestamp;
  // join.tx = transactionHash;
  // join.valueUSD = ZERO_BD;

  // for (let i: i32 = 0; i < tokenAddresses.length; i++) {
  //   let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
  //   let poolToken = loadPoolToken(poolId, tokenAddress);
  //
  //   // adding initial liquidity
  //   if (poolToken == null) {
  //     throw new Error('poolToken not found');
  //   }
  //   let tokenAmountIn = tokenToDecimal(amounts[i], poolToken.decimals);
  //   let newAmount = poolToken.balance.plus(tokenAmountIn);
  //   let tokenAmountInUSD = valueInUSD(tokenAmountIn, tokenAddress);
  //
  //   join.valueUSD = join.valueUSD.plus(tokenAmountInUSD);
  //
  //   poolToken.balance = newAmount;
  //   poolToken.save();
  //
  //   updateTokenBalances(tokenAddress, tokenAmountIn, TokenBalanceEvent.JOIN, event);
  // }
  //
  // join.save();

  const tokenAddresses = pool.tokensList;
  for (let i: i32 = 0; i < tokenAddresses.length; i++) {
    let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
    if (isPricingAsset(tokenAddress)) {
      let success = updatePoolLiquidity(event.params.poolId, tokenAddress, event.block);
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

function handlePoolExited(event: PoolBalanceChanged): void {
  let poolId = event.params.poolId;
  let amounts = event.params.deltas;
  let blockTimestamp = event.block.timestamp.toI32();
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
  // for (let i: i32 = 0; i < tokenAddresses.length; i++) {
  //   let tokenAddress: Address = Address.fromString(tokenAddresses[i].toHexString());
  //   let poolToken = loadBalancerPoolToken(poolId, tokenAddress);
  //
  //   // adding initial liquidity
  //   if (poolToken == null) {
  //     throw new Error('poolToken not found');
  //   }
  //   let tokenAmountOut = tokenToDecimal(amounts[i].neg(), poolToken.decimals);
  //   let newAmount = poolToken.balance.minus(tokenAmountOut);
  //   let tokenAmountOutUSD = valueInUSD(tokenAmountOut, tokenAddress);
  //
  //   exit.valueUSD = exit.valueUSD.plus(tokenAmountOutUSD);
  //
  //   poolToken.balance = newAmount;
  //   poolToken.save();
  // }
  //
  // exit.save();

  const pool = Pool.load(poolId);
  if (pool == null) {
    log.warning('Pool not found in handlePoolExited: {} {}', [
      poolId.toHexString(),
      event.transaction.hash.toHexString(),
    ]);
    return;
  }
  const tokenAddresses = pool.tokensList;
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

  getOrCreateUser(event.transaction.from);

  let poolId = event.params.poolId;

  let pool = Pool.load(poolId);
  if (pool == null) {
    log.warning('Pool not found in handleSwapEvent: {}', [poolId.toHexString()]);
    return;
  }

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
  if (hasVirtualSupply(pool)) {
    if (event.params.tokenIn == pool.address) {
      const sharesBalance = PoolShares.load(poolId) as PoolShares;
      sharesBalance.balance.minus(tokenToDecimal(event.params.amountIn, 18));
      sharesBalance.save();
    } else if (event.params.tokenOut == pool.address) {
      const sharesBalance = PoolShares.load(poolId) as PoolShares;
      sharesBalance.balance.plus(tokenToDecimal(event.params.amountOut, 18));
      sharesBalance.save();
    }

    let poolAddress = pool.address;
    let tokenInAddress: Address = event.params.tokenIn;
    let tokenOutAddress: Address = event.params.tokenOut;

    const inToken = getOrCreateToken(tokenInAddress);
    const outToken = getOrCreateToken(tokenOutAddress);
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

    // todo: store swaps?

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

    const poolTokenInBalance = getPoolToken(poolId, tokenInAddress);
    const poolTokenOutBalance = getPoolToken(poolId, tokenOutAddress);
    poolTokenInBalance.balance = poolTokenInBalance.balance.plus(tokenAmountIn);
    poolTokenInBalance.swapCount = poolTokenInBalance.swapCount.plus(BigInt.fromI32(1));
    // price
    poolTokenInBalance.save();

    poolTokenOutBalance.balance = poolTokenOutBalance.balance.minus(tokenAmountOut);
    poolTokenOutBalance.swapCount = poolTokenOutBalance.swapCount.plus(BigInt.fromI32(1));
    // price
    poolTokenOutBalance.save();

    // update swap counts for token
    // updates token snapshots as well
    // uptickSwapsForToken(tokenInAddress, event);
    // uptickSwapsForToken(tokenOutAddress, event);

    // let tradePair = getTradePair(tokenInAddress, tokenOutAddress);
    // tradePair.totalSwapVolume = tradePair.totalSwapVolume.plus(swapValueUSD);
    // tradePair.totalSwapFee = tradePair.totalSwapFee.plus(swapFeesUSD);
    // tradePair.save();

    // let tradePairSnapshot = getTradePairSnapshot(tradePair.id, blockTimestamp);
    // tradePairSnapshot.totalSwapVolume = tradePair.totalSwapVolume.plus(swapValueUSD);
    // tradePairSnapshot.totalSwapFee = tradePair.totalSwapFee.plus(swapFeesUSD);
    // tradePairSnapshot.save();

    // if (swap.tokenAmountOut == ZERO_BD || swap.tokenAmountIn == ZERO_BD) {
    //   return;
    // }

    // Capture price
    let block = event.block.number;
    if (isPricingAsset(tokenInAddress) && globalPoolMetric.totalLiquidity.gt(MIN_VIABLE_LIQUIDITY)) {
      // todo: do we need TokenPrice or can we just use latest price?
      const tokenPrice = createOrGetTokenPrice(tokenOutAddress, tokenInAddress, event.block);
      tokenPrice.amount = tokenAmountIn;

      if (pool.poolType === PoolType.Weighted) {
        // As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
        // based on the pool's weights and updated balances after the swap.
        const tokenInWeight = getTokenWeight(poolId, tokenInAddress);
        const tokenOutWeight = getTokenWeight(poolId, tokenOutAddress);
        tokenPrice.price = poolTokenInBalance.balance
          .div(tokenInWeight.weight)
          .div(poolTokenOutBalance.balance.div(tokenOutWeight.weight));
      } else {
        // Otherwise we can get a simple measure of the price from the ratio of amount in vs amount out
        tokenPrice.price = tokenAmountIn.div(tokenAmountOut);
      }
      tokenPrice.priceUSD = valueInUSD(tokenPrice.price, tokenInAddress);
      tokenPrice.save();
      updatePoolLiquidity(poolId, tokenInAddress, event.block);
    }
    if (isPricingAsset(tokenOutAddress) && globalPoolMetric.totalLiquidity.gt(MIN_VIABLE_LIQUIDITY)) {
      const tokenPrice = createOrGetTokenPrice(tokenInAddress, tokenOutAddress, event.block);
      //tokenPrice.poolTokenId = getPoolTokenId(poolId, tokenInAddress);
      tokenPrice.amount = tokenAmountOut;
      if (pool.poolType === PoolType.Weighted) {
        const tokenInWeight = getTokenWeight(poolId, tokenInAddress);
        const tokenOutWeight = getTokenWeight(poolId, tokenOutAddress);
        // As the swap is with a WeightedPool, we can easily calculate the spot price between the two tokens
        // based on the pool's weights and updated balances after the swap.
        tokenPrice.price = poolTokenOutBalance.balance
          .div(tokenOutWeight.weight)
          .div(poolTokenInBalance.balance.div(tokenInWeight.weight));
      } else {
        // Otherwise we can get a simple measure of the price from the ratio of amount out vs amount in
        tokenPrice.price = tokenAmountOut.div(tokenAmountIn);
      }
      tokenPrice.priceUSD = valueInUSD(tokenPrice.price, tokenOutAddress);
      tokenPrice.save();

      updatePoolLiquidity(poolId, tokenOutAddress, event.block);
    }
  }
}
