import { BigInt, Bytes, dataSource } from '@graphprotocol/graph-ts/index';
import { MasterChef, MasterChefFarmEmissionProvider, MasterChefFarmRewarderEmissionProvider } from '../types/schema';
import { MasterChef as MasterChefContract } from '../types/MasterChef/MasterChef';
import { getOrCreateToken } from './token';
import { scaleDown } from '../mappings/helpers/misc';
import { Address, ethereum } from '@graphprotocol/graph-ts';

export const masterChefId = Bytes.fromI32(1);

export function getOrCreateMasterChef(): MasterChef {
  let masterChef: MasterChef | null = MasterChef.load(masterChefId);
  if (masterChef === null) {
    const chefContract = MasterChefContract.bind(dataSource.address());
    const token = getOrCreateToken(chefContract.beets(), false);
    masterChef = new MasterChef(masterChefId);
    masterChef.address = dataSource.address();
    masterChef.totalAllocation = BigInt.zero();
    masterChef.emissionPerBlock = scaleDown(chefContract.beetsPerBlock(), 18);
    masterChef.emissionToken = token.address;
    masterChef.save();
  }
  return masterChef;
}

export function getExistingMasterChefFarmEmissionProvider(farmId: Bytes): MasterChefFarmEmissionProvider {
  return MasterChefFarmEmissionProvider.load(farmId) as MasterChefFarmEmissionProvider;
}

export function getExistingMasterChefFarmRewarderEmissionProvider(
  farmId: Bytes
): MasterChefFarmRewarderEmissionProvider {
  return MasterChefFarmRewarderEmissionProvider.load(farmId) as MasterChefFarmRewarderEmissionProvider;
}

export function getRewarder(address: Address, block: ethereum.Block): Rewarder {
  let rewarder = Rewarder.load(address);

  if (rewarder === null) {
    rewarder = new MasterChefFarmRewarderEmissionProvider(address);
    rewarder.address = address;

    if (address != Address.zero()) {
      const rewarderContract = SingleTokenRewarderContract.bind(address);
      let rewardTokenResult = rewarderContract.try_rewardToken();
      if (!rewardTokenResult.reverted) {
        const rewardToken = getRewardToken(rewarder.id, rewardTokenResult.value, block);
        const tokenAddress = rewarderContract.rewardToken();
        const token = getToken(tokenAddress);
        rewardToken.rewardPerSecond = rewarderContract.rewardPerSecond().divDecimal(BigDecimal_1e(token.decimals));
        rewardToken.token = token.id;
        rewardToken.save();
        SingleTokenRewarderTemplate.create(address);
      } else {
        const multiTokenRewarderContract = MultiTokenRewarderContract.bind(address);
        const tokenConfigs = multiTokenRewarderContract.getRewardTokenConfigs();
        for (let i = 0; i < tokenConfigs.length; i++) {
          const rewardToken = getRewardToken(rewarder.id, tokenConfigs[i].rewardToken, block);

          const token = getToken(tokenConfigs[i].rewardToken);
          rewardToken.token = token.id;
          rewardToken.tokenAddress = token.address;
          rewardToken.rewardPerSecond = tokenConfigs[i].rewardsPerSecond.divDecimal(BigDecimal_1e(token.decimals));
          rewardToken.save();
        }
        MultiTokenRewarderTemplate.create(address);
      }
    }
  }

  rewarder.save();
  return rewarder as Rewarder;
}
