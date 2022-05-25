import {
  LogOnReward,
  LogRewardPerSecond,
  SingleTokenRewarder as SingleTokenRewarderContract,
} from '../types/MasterChef/SingleTokenRewarder';
import { Address, Bytes, log } from '@graphprotocol/graph-ts';
import { getOrCreateMasterChefRewardToken } from '../entities/masterchef-emissions';
import { getExistingToken } from '../entities/token';
import { scaleDown } from './helpers/misc';
import { ClaimedEmission } from '../types/schema';
import { valueInUSD } from './pricing';
import { getOrCreateDailyUserPoolMetric } from '../entities/user';
import { getExistingFarm } from '../entities/emissions';

export function logRewardPerSecond(event: LogRewardPerSecond): void {
  log.info('[MasterChef: Rewarder] Log Reward Per Second for single token rewarder {}', [
    event.params.rewardPerSecond.toString(),
  ]);

  const rewarderContract = SingleTokenRewarderContract.bind(event.address);

  const tokenAddress = rewarderContract.rewardToken();
  const token = getExistingToken(tokenAddress);
  const masterChefRewardToken = getOrCreateMasterChefRewardToken(event.address, tokenAddress);
  masterChefRewardToken.rewardPerSecond = scaleDown(event.params.rewardPerSecond, token.decimals);
  masterChefRewardToken.save();
}

export function logOnReward(event: LogOnReward): void {
  const rewarderContract = SingleTokenRewarderContract.bind(event.address);
  const tokenAddress = rewarderContract.rewardToken();
  const token = getExistingToken(tokenAddress);

  const claimedAmount = scaleDown(event.params.amount, token.decimals);

  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const farm = getExistingFarm(farmId);
  const dailyUserPoolMetric = getOrCreateDailyUserPoolMetric(event.params.user, farm.poolId, event.block);

  const id = event.transaction.hash.concat(event.address).concat(event.params.user).concat(token.id);
  const claimedEmission = new ClaimedEmission(id);
  claimedEmission.user = event.params.user;
  claimedEmission.token = token.address;
  claimedEmission.amount = claimedAmount;
  claimedEmission.amountUSD = valueInUSD(claimedAmount, Address.fromBytes(token.address));
  claimedEmission.block = event.block.number;
  claimedEmission.timestamp = event.block.timestamp;
  claimedEmission.dailyUserPoolMetric = dailyUserPoolMetric.id;
  claimedEmission.save();
}
