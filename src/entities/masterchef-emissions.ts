import { BigInt, Bytes, dataSource } from '@graphprotocol/graph-ts/index';
import {
  MasterChef,
  MasterChefFarmEmissionProvider,
  MasterChefFarmRewarderEmissionProvider,
  MasterChefRewardToken,
} from '../types/schema';
import { MasterChef as MasterChefContract } from '../types/MasterChef/MasterChef';
import { getOrCreateToken } from './token';
import { scaleDown } from '../mappings/helpers/misc';
import { Address, BigDecimal } from '@graphprotocol/graph-ts';
import { SingleTokenRewarder as SingleTokenRewarderContract } from '../types/MasterChef/SingleTokenRewarder';
import {
  MultiTokenRewarder as MultiTokenRewarderTemplate,
  SingleTokenRewarder as SingleTokenRewarderTemplate,
} from '../types/templates';
import { MultiTokenRewarder as MultiTokenRewarderContract } from '../types/MasterChef/MultiTokenRewarder';

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
  address: Address
): MasterChefFarmRewarderEmissionProvider {
  return MasterChefFarmRewarderEmissionProvider.load(address) as MasterChefFarmRewarderEmissionProvider;
}

export function getOrCreateFarmRewarderEmissionProvider(
  rewarderAddress: Address,
  farmId: Bytes
): MasterChefFarmRewarderEmissionProvider {
  let farmRewarderEmissionProvider = MasterChefFarmRewarderEmissionProvider.load(farmId);
  if (farmRewarderEmissionProvider === null) {
    farmRewarderEmissionProvider = new MasterChefFarmRewarderEmissionProvider(rewarderAddress);
    farmRewarderEmissionProvider.farmId = farmId;
    farmRewarderEmissionProvider.farm = farmId;
    farmRewarderEmissionProvider.masterChef = masterChefId;
    farmRewarderEmissionProvider.address = rewarderAddress;
    farmRewarderEmissionProvider.save();

    const rewarderContract = SingleTokenRewarderContract.bind(rewarderAddress);
    let rewardTokenResult = rewarderContract.try_rewardToken();
    if (!rewardTokenResult.reverted) {
      const rewardTokenAddress = rewardTokenResult.value;
      const token = getOrCreateToken(rewardTokenAddress, false);
      const rewardToken = getOrCreateMasterChefRewardToken(rewardTokenAddress, Address.fromBytes(token.address));
      rewardToken.rewardPerSecond = scaleDown(rewarderContract.rewardPerSecond(), token.decimals);
      rewardToken.save();
      SingleTokenRewarderTemplate.create(rewarderAddress);
    } else {
      const multiTokenRewarderContract = MultiTokenRewarderContract.bind(rewarderAddress);
      const tokenConfigs = multiTokenRewarderContract.getRewardTokenConfigs();
      for (let i = 0; i < tokenConfigs.length; i++) {
        const token = getOrCreateToken(tokenConfigs[i].rewardToken, false);
        const rewardToken = getOrCreateMasterChefRewardToken(
          tokenConfigs[i].rewardToken,
          Address.fromBytes(token.address)
        );
        rewardToken.rewardPerSecond = scaleDown(tokenConfigs[i].rewardsPerSecond, token.decimals);
        rewardToken.save();
      }
      MultiTokenRewarderTemplate.create(rewarderAddress);
    }
  }
  return farmRewarderEmissionProvider;
}
export function getOrCreateMasterChefRewardToken(rewarderAddress: Address, token: Address): MasterChefRewardToken {
  const id = rewarderAddress.concat(token);
  let rewardToken = MasterChefRewardToken.load(id);
  if (rewardToken === null) {
    rewardToken = new MasterChefRewardToken(id);
    rewardToken.rewardPerSecond = BigDecimal.zero();
    rewardToken.token = token;
    rewardToken.tokenAddress = token;
    rewardToken.rewarder = rewarderAddress;
    rewardToken.save();
  }
  return rewardToken;
}
