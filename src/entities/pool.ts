import { Pool, PoolAddressToId, SwapConfig } from '../types/schema';
import { Address, Bytes } from '@graphprotocol/graph-ts/index';
import { getOrCreateVault } from './vault';
import { WeightedPool } from '../types/templates/WeightedPool/WeightedPool';
import { BigDecimal, ethereum } from '@graphprotocol/graph-ts';
import { Vault } from '../types/Vault/Vault';
import { VAULT_ADDRESS } from '../mappings/helpers/constants';
import { createPoolToken } from './pool-token';
import { scaleDown } from '../mappings/helpers/misc';
import { getOrCreateLifetimePoolMetrics } from './pool-metrics';
import { getOrCreateToken } from './token';

export function createPool(poolAddress: Address, poolType: string, phantomPool: boolean, block: ethereum.Block): Pool {
  const poolContract = WeightedPool.bind(poolAddress);
  const poolId = poolContract.getPoolId();

  const vaultContract = Vault.bind(VAULT_ADDRESS);
  const tokensCall = vaultContract.getPoolTokens(poolId);

  const pool = new Pool(poolId);

  const vault = getOrCreateVault(block);

  const lifetimePoolMetric = getOrCreateLifetimePoolMetrics(poolId, block);
  const shareToken = getOrCreateToken(Address.fromBytes(poolAddress), true);
  pool.address = poolAddress;
  pool.vault = vault.id;
  pool.name = poolContract.name();
  pool.owner = poolContract.getOwner();
  pool.poolType = poolType;
  pool.phantomPool = phantomPool;
  pool.shareToken = shareToken.id;
  pool.createTime = block.timestamp;
  pool.tokenAddresses = changetype<Bytes[]>(tokensCall.value0);
  pool.lifetimeMetrics = lifetimePoolMetric.id;

  let swapFee = poolContract.getSwapFeePercentage();

  const swapConfig = new SwapConfig(pool.id);
  swapConfig.swapEnabled = true;
  swapConfig.fee = scaleDown(swapFee, 18);
  swapConfig.managementFee = BigDecimal.zero();
  swapConfig.save();

  pool.swapConfig = swapConfig.id;

  pool.save();

  // create the mapping from address => poolId
  const poolAddressToId = new PoolAddressToId(poolAddress);
  poolAddressToId.poolId = pool.id;
  poolAddressToId.save();

  for (let i: i32 = 0; i < tokensCall.value0.length; i++) {
    // create all underlying token balances
    createPoolToken(pool.id, tokensCall.value0[i]);
  }
  return pool;
}

export function loadExistingPool(poolId: Bytes): Pool {
  return Pool.load(poolId) as Pool;
}

export function isPoolAddress(address: Address): boolean {
  const poolAddressToId = PoolAddressToId.load(address);
  return poolAddressToId != null;
}

export function getPoolByAddress(address: Address): Pool {
  const mapping = PoolAddressToId.load(address);

  if (mapping === null) {
    throw new Error(`Pool mapping not found for address  ${address.toHexString()}`);
  }

  const pool = Pool.load(mapping.poolId);
  if (pool === null) {
    throw new Error(`Pool not found for id ${mapping.poolId.toHexString()}`);
  }
  return pool;
}
