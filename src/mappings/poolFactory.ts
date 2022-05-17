import { PoolType } from './helpers/pools';
import { updatePoolWeights } from './helpers/weighted';
import { Address, BigDecimal } from '@graphprotocol/graph-ts';
import { PoolCreated } from '../types/WeightedPoolFactory/WeightedPoolFactory';
import { LinearPoolData, LinearPoolTarget, StablePoolData } from '../types/schema';
import {
  LinearPool as LinearPoolTemplate,
  LiquidityBootstrappingPool as LiquidityBootstrappingPoolTemplate,
  MetaStablePool as MetaStablePoolTemplate,
  StablePhantomPool as StablePhantomPoolTemplate,
  StablePool as StablePoolTemplate,
  WeightedPool as WeightedPoolTemplate,
} from '../types/templates';
import { LinearPool } from '../types/templates/LinearPool/LinearPool';
import { createPool } from '../entities/pool';
import { updateAmpFactor } from './helpers/stable';
import { tokenToDecimal } from './helpers/misc';
import { getOrCreateGlobalPoolMetrics } from '../entities/pool-metrics';

export function handleNewWeightedPool(event: PoolCreated): void {
  let poolAddress: Address = event.params.pool;
  const pool = createPool(poolAddress, PoolType.Weighted, false, event.block);
  updatePoolWeights(pool.id);
  WeightedPoolTemplate.create(event.params.pool);
}

export function handleNewLiquidityBootstrappingPool(event: PoolCreated): void {
  let poolAddress: Address = event.params.pool;
  const pool = createPool(poolAddress, PoolType.LiquidityBootstrapping, false, event.block);
  updatePoolWeights(pool.id);
  LiquidityBootstrappingPoolTemplate.create(event.params.pool);
}

export function handleNewStablePool(event: PoolCreated): void {
  const pool = createPool(event.params.pool, PoolType.Stable, false, event.block);
  const poolData = new StablePoolData(pool.id.toHexString());
  poolData.pool = pool.id;
  poolData.poolId = pool.id;

  pool.customPoolData = poolData.id;

  const amp = updateAmpFactor(pool);
  poolData.amp = amp.id;
  poolData.save();
  pool.save();

  StablePoolTemplate.create(event.params.pool);
}
export function handleNewMetaStablePool(event: PoolCreated): void {
  const pool = createPool(event.params.pool, PoolType.MetaStable, false, event.block);
  const poolData = new StablePoolData(pool.id.toHexString());
  poolData.pool = pool.id;
  poolData.poolId = pool.id;

  pool.customPoolData = poolData.id;

  const amp = updateAmpFactor(pool);
  poolData.amp = amp.id;
  poolData.save();
  pool.save();
  MetaStablePoolTemplate.create(event.params.pool);
}

export function handleNewStablePhantomPool(event: PoolCreated): void {
  const pool = createPool(event.params.pool, PoolType.StablePhantom, true, event.block);
  const poolData = new StablePoolData(pool.id.toHexString());
  poolData.pool = pool.id;
  poolData.poolId = pool.id;

  pool.customPoolData = poolData.id;

  const amp = updateAmpFactor(pool);
  poolData.amp = amp.id;
  poolData.save();
  pool.save();
  StablePhantomPoolTemplate.create(event.params.pool);
}

export function handleNewLinearPool(event: PoolCreated): void {
  const pool = createPool(event.params.pool, PoolType.Linear, true, event.block);
  const linearPoolData = new LinearPoolData(pool.id.toHexString());
  linearPoolData.pool = pool.id;
  linearPoolData.poolId = pool.id;

  pool.customPoolData = linearPoolData.id;
  pool.save();

  let poolContract = LinearPool.bind(event.params.pool);

  linearPoolData.mainIndex = poolContract.getMainIndex().toI32();
  linearPoolData.wrappedIndex = poolContract.getWrappedIndex().toI32();
  let targetsCall = poolContract.try_getTargets();
  const linearPoolTarget = new LinearPoolTarget(pool.id);
  linearPoolTarget.lowerTarget = tokenToDecimal(targetsCall.value.value0, 18);
  linearPoolTarget.upperTarget = tokenToDecimal(targetsCall.value.value1, 18);
  linearPoolTarget.save();

  linearPoolData.targets = linearPoolTarget.id;
  linearPoolData.save();

  const globalMetrics = getOrCreateGlobalPoolMetrics(pool.id, event.block);
  // remove initial minted tokens
  let maxTokenBalance = BigDecimal.fromString('5192296858534827.628530496329220095');
  globalMetrics.totalShares = globalMetrics.totalShares.minus(maxTokenBalance);
  globalMetrics.save();

  LinearPoolTemplate.create(event.params.pool);
}
