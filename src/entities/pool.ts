import { Pool } from '../types/schema';
import { Address, Bytes } from '@graphprotocol/graph-ts/index';
import { getVault } from './vault';
import { WeightedPool } from '../types/templates/WeightedPool/WeightedPool';
import { ethereum } from '@graphprotocol/graph-ts';
import { Vault } from '../types/Vault/Vault';
import { VAULT_ADDRESS } from '../mappings/helpers/constants';
import { getPoolTokenBalance } from './pool-token-balance';
import { getPoolSharesBalance } from './pool-shares-balance';
import { getPoolConfig } from './pool-config';
import { scaleDown } from '../mappings/helpers/misc';

export function createPool(poolAddress: Address, block: ethereum.Block): Pool {
  let pool = Pool.load(poolAddress);
  if (pool === null) {
    pool = new Pool(poolAddress);

    const vault = getVault();
    const poolContract = WeightedPool.bind(poolAddress);
    const poolId = poolContract.getPoolId();

    // create pool shares entry
    getPoolSharesBalance(pool.id, poolAddress, block);

    const vaultContract = Vault.bind(VAULT_ADDRESS);
    const tokensCall = vaultContract.getPoolTokens(poolId);

    for (let i: i32 = 0; i < tokensCall.value0.length; i++) {
      // create all underlying token balances
      getPoolTokenBalance(pool.id, tokensCall.value0[i], block);
    }
    pool.poolId = poolId;
    pool.address = poolAddress;
    pool.vault = vault.id;
    pool.name = poolContract.name();
    pool.owner = poolContract.getOwner();
    pool.createTime = block.timestamp;
    pool.tokensList = changetype<Bytes[]>(tokensCall.value0);

    let swapFee = poolContract.getSwapFeePercentage();

    const poolConfig = getPoolConfig(poolId);
    poolConfig.swapFee = scaleDown(swapFee, 18);
    poolConfig.save();

    pool.config = poolConfig.id;

    pool.save();
  }
  return pool;
}
