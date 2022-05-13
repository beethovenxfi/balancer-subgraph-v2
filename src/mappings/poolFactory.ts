import { ZERO_BD, VAULT_ADDRESS, ZERO } from './helpers/constants';
import { PoolType } from './helpers/pools';

import { updatePoolWeights } from './helpers/weighted';

import { BigInt, Address, Bytes, BigDecimal } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/WeightedPoolFactory/WeightedPoolFactory';
import { Balancer, Pool } from '../types/schema';

// datasource
import { WeightedPool as WeightedPoolTemplate } from '../types/templates';
import { StablePool as StablePoolTemplate } from '../types/templates';
import { MetaStablePool as MetaStablePoolTemplate } from '../types/templates';
import { StablePhantomPool as StablePhantomPoolTemplate } from '../types/templates';
import { ConvergentCurvePool as CCPoolTemplate } from '../types/templates';
import { LiquidityBootstrappingPool as LiquidityBootstrappingPoolTemplate } from '../types/templates';
import { InvestmentPool as InvestmentPoolTemplate } from '../types/templates';
import { LinearPool as LinearPoolTemplate } from '../types/templates';

import { Vault } from '../types/Vault/Vault';
import { WeightedPool } from '../types/templates/WeightedPool/WeightedPool';
import { StablePool } from '../types/templates/StablePool/StablePool';
import { ConvergentCurvePool } from '../types/templates/ConvergentCurvePool/ConvergentCurvePool';
import { LinearPool } from '../types/templates/LinearPool/LinearPool';
import { ERC20 } from '../types/Vault/ERC20';
import { createPool } from '../entities/pool';

export function handleNewWeightedPool(event: PoolCreated): void {
  let poolAddress: Address = event.params.pool;
  const pool = createPool(poolAddress, PoolType.Weighted, false, null, event.block);
  // createWeightedPoolData(pool.id);
  // Load pool with initial weights
  updatePoolWeights(pool.id);
  WeightedPoolTemplate.create(event.params.pool);
}

// export function handleNewLiquidityBootstrappingPool(event: PoolCreated): void {
//   let poolAddress: Address = event.params.pool;
//   const pool = createPool(poolAddress, event.block);
//   updatePoolWeights(pool.id);
//   LiquidityBootstrappingPoolTemplate.create(event.params.pool);
// }
//
// export function handleNewStablePool(event: PoolCreated): void {
//   createStableLikePool(event, PoolType.Stable);
//   StablePoolTemplate.create(event.params.pool);
// }
//
// export function handleNewStablePhantomPool(event: PoolCreated): void {
//   createStableLikePool(event, PoolType.StablePhantom);
//   StablePhantomPoolTemplate.create(event.params.pool);
// }
//
// export function handleNewLinearPool(event: PoolCreated): void {
//   let poolAddress: Address = event.params.pool;
//
//   let poolContract = LinearPool.bind(poolAddress);
//
//   let poolIdCall = poolContract.try_getPoolId();
//   let poolId = poolIdCall.value;
//
//   let swapFeeCall = poolContract.try_getSwapFeePercentage();
//   let swapFee = swapFeeCall.value;
//
//   let pool = handleNewPool(event, poolId, swapFee);
//
//   pool.poolType = PoolType.Linear;
//   pool.factory = event.address;
//
//   let mainIndexCall = poolContract.try_getMainIndex();
//   pool.mainIndex = mainIndexCall.value.toI32();
//   let wrappedIndexCall = poolContract.try_getWrappedIndex();
//   pool.wrappedIndex = wrappedIndexCall.value.toI32();
//
//   let targetsCall = poolContract.try_getTargets();
//   pool.lowerTarget = tokenToDecimal(targetsCall.value.value0, 18);
//   pool.upperTarget = tokenToDecimal(targetsCall.value.value1, 18);
//
//   let vaultContract = Vault.bind(VAULT_ADDRESS);
//   let tokensCall = vaultContract.try_getPoolTokens(poolId);
//
//   if (!tokensCall.reverted) {
//     let tokens = tokensCall.value.value0;
//     pool.tokensList = changetype<Bytes[]>(tokens);
//
//     for (let i: i32 = 0; i < tokens.length; i++) {
//       createPoolTokenEntity(poolId.toHexString(), tokens[i]);
//     }
//   }
//   let maxTokenBalance = BigDecimal.fromString('5192296858534827.628530496329220095');
//   pool.totalShares = pool.totalShares.minus(maxTokenBalance);
//   pool.save();
//
//   LinearPoolTemplate.create(poolAddress);
// }
//
// function handleNewPool(event: PoolCreated, poolId: Bytes, swapFee: BigInt): Pool {
//   let poolAddress: Address = event.params.pool;
//
//   let pool = Pool.load(poolId);
//   if (pool === null) {
//     pool = newPoolEntity(poolId.toHexString());
//
//     pool.swapFee = scaleDown(swapFee, 18);
//     pool.createTime = event.block.timestamp.toI32();
//     pool.address = poolAddress;
//     pool.tx = event.transaction.hash;
//     pool.swapEnabled = true;
//
//     let bpt = ERC20.bind(poolAddress);
//
//     let nameCall = bpt.try_name();
//     if (!nameCall.reverted) {
//       pool.name = nameCall.value;
//     }
//
//     let symbolCall = bpt.try_symbol();
//     if (!symbolCall.reverted) {
//       pool.symbol = symbolCall.value;
//     }
//     pool.save();
//
//     let vault = findOrInitializeVault();
//     vault.poolCount += 1;
//     vault.save();
//
//     let vaultSnapshot = getBalancerSnapshot(vault.id, event.block.timestamp.toI32());
//     vaultSnapshot.poolCount += 1;
//     vaultSnapshot.save();
//   }
//
//   return pool;
// }
