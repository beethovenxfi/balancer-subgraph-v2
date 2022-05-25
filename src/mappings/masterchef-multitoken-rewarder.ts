import { Address, Bytes, log } from '@graphprotocol/graph-ts';
import { LogOnReward, LogRewardsPerSecond } from '../types/MasterChef/MultiTokenRewarder';
import { getExistingToken } from '../entities/token';
import { getOrCreateMasterChefRewardToken } from '../entities/masterchef-emissions';
import { scaleDown } from './helpers/misc';
import { getExistingFarm } from '../entities/emissions';
import { getOrCreateDailyUserPoolMetric } from '../entities/user';
import { ClaimedEmission } from '../types/schema';
import { valueInUSD } from './pricing';

export function logRewardsPerSecond(event: LogRewardsPerSecond): void {
  const rewardTokens = event.params.rewardTokens;
  const rewardsPerSecond = event.params.rewardsPerSecond;
  log.info('[MasterChef: Rewarder] Log Rewards Per Second for MultiToken rewarder. rewards {}', [
    rewardsPerSecond.toString(),
  ]);

  for (let i = 0; i < rewardTokens.length; i++) {
    const rewardToken = getOrCreateMasterChefRewardToken(event.address, rewardTokens[i]);
    const token = getExistingToken(rewardTokens[i]);
    rewardToken.rewardPerSecond = scaleDown(rewardsPerSecond[i], token.decimals);
    rewardToken.save();
  }
}

export function logOnReward(event: LogOnReward): void {
  const token = getExistingToken(event.params.rewardToken);
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
