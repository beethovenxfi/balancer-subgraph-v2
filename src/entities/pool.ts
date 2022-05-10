import { Pool, PoolAddressToId, SwapConfig } from '../types/schema';
import { Address, Bytes } from '@graphprotocol/graph-ts/index';
import { getOrCreateVault } from './vault';
import { WeightedPool } from '../types/templates/WeightedPool/WeightedPool';
import { ethereum } from '@graphprotocol/graph-ts';
import { Vault } from '../types/Vault/Vault';
import { VAULT_ADDRESS } from '../mappings/helpers/constants';
import { getPoolToken } from './pool-token';
import { scaleDown } from '../mappings/helpers/misc';
import { getOrCreateGlobalPoolMetrics } from './pool-metrics';

export function createPool(
  poolAddress: Address,
  poolType: string,
  customPoolDataId: Bytes | null,
  block: ethereum.Block
): Pool {
  const poolContract = WeightedPool.bind(poolAddress);
  const poolId = poolContract.getPoolId();

  const vaultContract = Vault.bind(VAULT_ADDRESS);
  const tokensCall = vaultContract.getPoolTokens(poolId);

  const pool = new Pool(poolId);

  const vault = getOrCreateVault(block);

  const globalMetrics = getOrCreateGlobalPoolMetrics(poolId, block);

  pool.address = poolAddress;
  pool.vault = vault.id;
  pool.name = poolContract.name();
  pool.owner = poolContract.getOwner();
  pool.poolType = poolType;
  pool.createTime = block.timestamp;
  pool.tokensList = changetype<Bytes[]>(tokensCall.value0);
  pool.globalMetrics = globalMetrics.id;

  let swapFee = poolContract.getSwapFeePercentage();

  const swapConfig = new SwapConfig(pool.id);
  swapConfig.swapEnabled = true;
  swapConfig.fee = scaleDown(swapFee, 18);
  swapConfig.save();

  pool.swapConfig = swapConfig.id;

  pool.save();

  // create the mapping from address => poolId
  const poolAddressToId = new PoolAddressToId(poolAddress);
  poolAddressToId.poolId = pool.id;
  poolAddressToId.save();

  for (let i: i32 = 0; i < tokensCall.value0.length; i++) {
    // create all underlying token balances
    getPoolToken(pool.id, tokensCall.value0[i]);
  }
  return pool;
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
