import { Address, BigDecimal, log } from '@graphprotocol/graph-ts';
import {
  ChildChainStreamer as ChildChainStreamerTemplate,
  RewardsOnlyGauge as RewardsOnlyGaugeTemplate,
} from '../types/templates';
import { RewardsOnlyGaugeCreated } from '../types/ChildChainLiquidityGaugeFactory/ChildChainLiquidityGaugeFactory';
import { getGaugeFactory, getOrCreateGaugeRewardToken } from '../entities/gauge-emissions';
import { WeightedPool } from '../types/Vault/WeightedPool';
import { Farm, GaugeEmissionProvider, GaugeStreamer, LifetimeFarmMetric } from '../types/schema';
import { Transfer } from '../types/ChildChainLiquidityGaugeFactory/RewardsOnlyGauge';
import { ZERO_ADDRESS } from './helpers/constants';
import {
  getOrCreateDailyUserPoolMetric,
  getOrCreateLifetimeUserMetric,
  getOrCreateStakedPoolShares,
} from '../entities/user';
import { scaleDown } from './helpers/misc';
import { getExistingLifetimeFarmMetrics, getOrCreateDailyFarmMetric } from '../entities/emissions';
import { valueInUSD } from './pricing';
import { RewardDistributorUpdated } from '../types/templates/ChildChainStreamer/ChildChainStreamer';

export function handleRewardsOnlyGaugeCreated(event: RewardsOnlyGaugeCreated): void {
  let pool = WeightedPool.bind(event.params.pool);
  const poolId = pool.getPoolId();

  const farm = new Farm(event.params.gauge);
  farm.poolId = poolId;
  farm.pool = poolId;
  farm.token = event.params.pool;
  farm.tokenAddress = event.params.pool;

  const lifetimeFarmMetric = new LifetimeFarmMetric(event.params.gauge);
  lifetimeFarmMetric.totalShares = BigDecimal.zero();
  lifetimeFarmMetric.totalLiquidity = BigDecimal.zero();
  lifetimeFarmMetric.save();

  farm.lifetimeMetric = lifetimeFarmMetric.id;
  farm.save();

  let factory = getGaugeFactory(event.address);
  factory.numGauges += 1;
  factory.save();

  const gaugeEmissionProvider = new GaugeEmissionProvider(event.params.gauge);
  gaugeEmissionProvider.farm = event.params.gauge;
  gaugeEmissionProvider.farmId = event.params.gauge;
  gaugeEmissionProvider.address = event.params.gauge;
  gaugeEmissionProvider.factory = factory.id;
  gaugeEmissionProvider.streamer = event.params.streamer;
  gaugeEmissionProvider.save();

  const streamer = new GaugeStreamer(event.params.streamer);
  streamer.address = event.params.streamer;
  streamer.emissionProvider = event.params.gauge;
  streamer.save();

  RewardsOnlyGaugeTemplate.create(event.params.gauge);
  ChildChainStreamerTemplate.create(event.params.streamer);
}

export function handleRewardDistributorUpdated(event: RewardDistributorUpdated): void {
  const streamer = GaugeStreamer.load(event.address) as GaugeStreamer;
  const token = getOrCreateGaugeRewardToken(event.params.reward_token, Address.fromBytes(streamer.emissionProvider));
  if (event.params.distributor === Address.zero()) {
    token.streamer = null;
  } else {
    token.streamer = streamer.id;
  }
  token.save();
}

export function handleTransfer(event: Transfer): void {
  let gaugeAddress = event.address;

  let gauge = GaugeEmissionProvider.load(gaugeAddress) as GaugeEmissionProvider;
  const farm = Farm.load(gaugeAddress);
  if (farm === null) {
    log.warning('No farm found for transfer event', [gaugeAddress.toHexString()]);
    return;
  }

  /* eslint-disable no-underscore-dangle */
  let fromAddress = event.params._from;
  let toAddress = event.params._to;
  let value = event.params._value;
  /* eslint-enable no-underscore-dangle */

  let isMint = fromAddress.toHexString() == ZERO_ADDRESS;
  let isBurn = toAddress.toHexString() == ZERO_ADDRESS;

  const lifetimeFarmMetric = getExistingLifetimeFarmMetrics(gaugeAddress);
  const dailyFarmMetric = getOrCreateDailyFarmMetric(gaugeAddress, event.block);

  const amount = scaleDown(value, 18);
  const valueUSD = valueInUSD(amount, Address.fromBytes(farm.tokenAddress));
  if (isMint) {
    const userShareTo = getOrCreateStakedPoolShares(toAddress, gaugeAddress);
    userShareTo.balance = userShareTo.balance.plus(amount);
    userShareTo.save();

    lifetimeFarmMetric.totalShares = lifetimeFarmMetric.totalShares.plus(amount);
    lifetimeFarmMetric.totalLiquidity = lifetimeFarmMetric.totalLiquidity.plus(valueUSD);
    lifetimeFarmMetric.save();

    dailyFarmMetric.liqudityChange24h = dailyFarmMetric.liqudityChange24h.plus(valueUSD);
    dailyFarmMetric.totalLiquidity = lifetimeFarmMetric.totalLiquidity;
    dailyFarmMetric.save();
  } else if (isBurn) {
    const userShareFrom = getOrCreateStakedPoolShares(fromAddress, gaugeAddress);
    userShareFrom.balance = userShareFrom.balance.minus(amount);
    userShareFrom.save();
    lifetimeFarmMetric.totalShares = lifetimeFarmMetric.totalShares.minus(amount);
    lifetimeFarmMetric.totalLiquidity = lifetimeFarmMetric.totalLiquidity.minus(valueUSD);
    lifetimeFarmMetric.save();

    dailyFarmMetric.liqudityChange24h = dailyFarmMetric.liqudityChange24h.minus(valueUSD);
    dailyFarmMetric.totalLiquidity = lifetimeFarmMetric.totalLiquidity;
    dailyFarmMetric.save();
  } else {
    const dailyUserPoolToMetric = getOrCreateDailyUserPoolMetric(toAddress, farm.poolId, event.block);
    const dailyUserPoolFromMetric = getOrCreateDailyUserPoolMetric(fromAddress, farm.poolId, event.block);
    const lifetimeUserToMetric = getOrCreateLifetimeUserMetric(toAddress);
    const lifetimeUserFromMetric = getOrCreateLifetimeUserMetric(fromAddress);
    const userShareTo = getOrCreateStakedPoolShares(toAddress, gaugeAddress);
    const userShareFrom = getOrCreateStakedPoolShares(fromAddress, gaugeAddress);

    dailyUserPoolFromMetric.withdrawn = dailyUserPoolFromMetric.withdrawn.plus(valueUSD);
    dailyUserPoolFromMetric.totalShares = dailyUserPoolFromMetric.totalShares.minus(amount);
    dailyUserPoolFromMetric.save();
    lifetimeUserFromMetric.withdrawn = lifetimeUserFromMetric.withdrawn.plus(valueUSD);
    lifetimeUserFromMetric.save();
    userShareFrom.balance = userShareFrom.balance.minus(amount);
    userShareFrom.save();

    dailyUserPoolToMetric.invested = dailyUserPoolToMetric.withdrawn.plus(valueUSD);
    dailyUserPoolToMetric.totalShares = dailyUserPoolToMetric.totalShares.plus(amount);
    dailyUserPoolToMetric.save();
    lifetimeUserToMetric.invested = lifetimeUserToMetric.invested.plus(valueUSD);
    lifetimeUserToMetric.save();
    userShareTo.balance = userShareTo.balance.plus(amount);
    userShareTo.save();
  }

  gauge.save();
}
