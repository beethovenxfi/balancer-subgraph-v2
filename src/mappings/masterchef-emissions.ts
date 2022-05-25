import { Address, BigDecimal, Bytes, log } from '@graphprotocol/graph-ts';

import {
  Deposit,
  EmergencyWithdraw,
  Harvest,
  LogPoolAddition,
  LogSetPool,
  UpdateEmissionRate,
  Withdraw,
} from '../types/MasterChef/MasterChef';
import {
  getExistingMasterChefFarmEmissionProvider,
  getOrCreateFarmRewarderEmissionProvider,
  getOrCreateMasterChef,
} from '../entities/masterchef-emissions';
import {
  ClaimedEmission,
  Farm,
  LifetimeFarmMetric,
  MasterChefFarmEmissionProvider,
  MasterChefFarmRewarderEmissionProvider,
  PoolAddressToId,
} from '../types/schema';
import { FBEETS_ADDRESS, FBEETS_POOL_ID } from './helpers/constants';
import { getExistingToken } from '../entities/token';
import { scaleDown } from './helpers/misc';
import { getExistingFarm, getExistingLifetimeFarmMetrics, getOrCreateDailyFarmMetric } from '../entities/emissions';
import { getExistingLifetimePoolMetrics } from '../entities/pool-metrics';
import { getOrCreateDailyUserPoolMetric, getOrCreateStakedPoolShares } from '../entities/user';
import { valueInUSD } from './pricing';

export function logPoolAddition(event: LogPoolAddition): void {
  log.info('[MasterChef] Log Pool Addition {} {} {} {}', [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
    event.params.lpToken.toHex(),
    event.params.rewarder.toHex(),
  ]);

  const masterChef = getOrCreateMasterChef();

  const lpToken = event.params.lpToken;

  const poolMapping = PoolAddressToId.load(lpToken);

  let poolId: Bytes;
  if (poolMapping !== null) {
    poolId = poolMapping.poolId;
  } else if (lpToken.equals(FBEETS_ADDRESS)) {
    poolId = FBEETS_POOL_ID;
  } else {
    log.error('[MasterChef] No pool mapping found for {}', [lpToken.toHex()]);
    return;
  }

  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const farm = new Farm(farmId);
  farm.poolId = poolId;
  farm.pool = poolId;
  farm.token = event.params.lpToken;
  farm.tokenAddress = lpToken;

  const lifetimeFarmMetric = new LifetimeFarmMetric(farmId);
  lifetimeFarmMetric.totalShares = BigDecimal.zero();
  lifetimeFarmMetric.totalLiquidity = BigDecimal.zero();
  lifetimeFarmMetric.save();

  farm.lifetimeFarmMetric = lifetimeFarmMetric.id;
  farm.save();

  const masterChefFarmEmissionProvider = new MasterChefFarmEmissionProvider(farmId);
  masterChefFarmEmissionProvider.masterChef = masterChef.id;
  masterChefFarmEmissionProvider.farm = farm.id;
  masterChefFarmEmissionProvider.farmId = farm.id;
  masterChefFarmEmissionProvider.masterChefPoolId = event.params.pid;
  masterChefFarmEmissionProvider.allocation = event.params.allocPoint;
  masterChefFarmEmissionProvider.save();

  const rewarderAddress = event.params.rewarder;
  if (rewarderAddress.notEqual(Address.zero())) {
    getOrCreateFarmRewarderEmissionProvider(rewarderAddress, farmId);
  }

  masterChef.totalAllocation = masterChef.totalAllocation.plus(masterChefFarmEmissionProvider.allocation);
  masterChef.save();
}

export function logSetPool(event: LogSetPool): void {
  log.info('[MasterChef] Log Set Pool {} {} {} {}', [
    event.params.pid.toString(),
    event.params.allocPoint.toString(),
    event.params.rewarder.toHex(),
    event.params.overwrite ? 'true' : 'false',
  ]);

  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const masterChefFarmEmissionProvider = getExistingMasterChefFarmEmissionProvider(farmId);

  const masterChef = getOrCreateMasterChef();
  masterChef.totalAllocation = masterChef.totalAllocation.plus(
    event.params.allocPoint.minus(masterChefFarmEmissionProvider.allocation)
  );
  masterChef.save();

  masterChefFarmEmissionProvider.allocation = event.params.allocPoint;
  masterChefFarmEmissionProvider.save();
  if (event.params.overwrite) {
    const existingRewarder = MasterChefFarmRewarderEmissionProvider.load(farmId);
    if (existingRewarder !== null) {
      existingRewarder.farm = null;
      existingRewarder.farmId = null;
      existingRewarder.save();
    }
    getOrCreateFarmRewarderEmissionProvider(event.params.rewarder, farmId);
  }
}

export function updateEmissionRate(event: UpdateEmissionRate): void {
  log.info('[MasterChef] Log update emission rate {} {}', [
    event.params.user.toString(),
    event.params._beetsPerSec.toString(),
  ]);

  const masterChef = getOrCreateMasterChef();
  masterChef.emissionPerBlock = scaleDown(event.params._beetsPerSec, 18);
  masterChef.save();
}

export function deposit(event: Deposit): void {
  log.info('[MasterChef] Log Deposit {} {} {} {}', [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
    event.params.to.toHex(),
  ]);

  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const farm = getExistingFarm(farmId);
  const lifetimePoolMetrics = getExistingLifetimePoolMetrics(farm.poolId);

  const pricePerShare = lifetimePoolMetrics.totalLiquidity.div(lifetimePoolMetrics.totalShares);

  const lifetimeFarmMetrics = getExistingLifetimeFarmMetrics(farmId);
  const dailyFarmMetric = getOrCreateDailyFarmMetric(farmId, event.block);

  const depositedAmount = scaleDown(event.params.amount, 18);
  lifetimeFarmMetrics.totalLiquidity = lifetimeFarmMetrics.totalLiquidity.plus(depositedAmount.times(pricePerShare));
  lifetimeFarmMetrics.totalShares = lifetimeFarmMetrics.totalShares.plus(depositedAmount);
  lifetimeFarmMetrics.save();

  dailyFarmMetric.liqudityChange24h = dailyFarmMetric.liqudityChange24h.plus(depositedAmount.times(pricePerShare));
  dailyFarmMetric.totalLiquidity = lifetimeFarmMetrics.totalLiquidity;
  dailyFarmMetric.save();

  const stakedPoolShares = getOrCreateStakedPoolShares(event.params.to, farmId);
  stakedPoolShares.balance = stakedPoolShares.balance.plus(depositedAmount);
  stakedPoolShares.save();
}

export function withdraw(event: Withdraw): void {
  log.info('[MasterChef] Log Withdraw {} {} {} {}', [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
    event.params.to.toHex(),
  ]);
  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const farm = getExistingFarm(farmId);
  const lifetimePoolMetrics = getExistingLifetimePoolMetrics(farm.poolId);

  const pricePerShare = lifetimePoolMetrics.totalLiquidity.div(lifetimePoolMetrics.totalShares);

  const lifetimeFarmMetrics = getExistingLifetimeFarmMetrics(farmId);
  const dailyFarmMetric = getOrCreateDailyFarmMetric(farmId, event.block);

  const withdrawnAmount = scaleDown(event.params.amount, 18);
  lifetimeFarmMetrics.totalLiquidity = lifetimeFarmMetrics.totalLiquidity.minus(withdrawnAmount.times(pricePerShare));
  lifetimeFarmMetrics.totalShares = lifetimeFarmMetrics.totalShares.minus(withdrawnAmount);
  lifetimeFarmMetrics.save();

  dailyFarmMetric.liqudityChange24h = dailyFarmMetric.liqudityChange24h.minus(withdrawnAmount.times(pricePerShare));
  dailyFarmMetric.totalLiquidity = lifetimeFarmMetrics.totalLiquidity;
  dailyFarmMetric.save();

  const stakedPoolShares = getOrCreateStakedPoolShares(event.params.to, farmId);
  stakedPoolShares.balance = stakedPoolShares.balance.minus(withdrawnAmount);
  stakedPoolShares.save();
}

export function emergencyWithdraw(event: EmergencyWithdraw): void {
  log.info('[MasterChef] Log Emergency Withdraw {} {} {} {}', [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
    event.params.to.toHex(),
  ]);
  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const farm = getExistingFarm(farmId);
  const lifetimePoolMetrics = getExistingLifetimePoolMetrics(farm.poolId);

  const pricePerShare = lifetimePoolMetrics.totalLiquidity.div(lifetimePoolMetrics.totalShares);

  const lifetimeFarmMetrics = getExistingLifetimeFarmMetrics(farmId);
  const dailyFarmMetric = getOrCreateDailyFarmMetric(farmId, event.block);

  const withdrawnAmount = scaleDown(event.params.amount, 18);
  lifetimeFarmMetrics.totalLiquidity = lifetimeFarmMetrics.totalLiquidity.minus(withdrawnAmount.times(pricePerShare));
  lifetimeFarmMetrics.totalShares = lifetimeFarmMetrics.totalShares.minus(withdrawnAmount);
  lifetimeFarmMetrics.save();

  dailyFarmMetric.liqudityChange24h = dailyFarmMetric.liqudityChange24h.minus(withdrawnAmount.times(pricePerShare));
  dailyFarmMetric.totalLiquidity = lifetimeFarmMetrics.totalLiquidity;
  dailyFarmMetric.save();

  const stakedPoolShares = getOrCreateStakedPoolShares(event.params.to, farmId);
  stakedPoolShares.balance = stakedPoolShares.balance.minus(withdrawnAmount);
  stakedPoolShares.save();
}

export function harvest(event: Harvest): void {
  log.info('[MasterChef] Log Harvest {} {} {}', [
    event.params.user.toHex(),
    event.params.pid.toString(),
    event.params.amount.toString(),
  ]);

  const masterChef = getOrCreateMasterChef();
  const emissionToken = getExistingToken(Address.fromBytes(masterChef.emissionToken));
  const farmId = Bytes.fromI32(event.params.pid.toI32());
  const farm = getExistingFarm(farmId);

  const claimedAmount = scaleDown(event.params.amount, emissionToken.decimals);

  const id = event.transaction.hash
    .concat(masterChef.id)
    .concatI32(event.params.pid.toI32())
    .concat(event.params.user)
    .concat(emissionToken.id);

  const dailyUserPoolMetric = getOrCreateDailyUserPoolMetric(event.params.user, farm.poolId, event.block);

  const claimedEmission = new ClaimedEmission(id);
  claimedEmission.user = event.params.user;
  claimedEmission.token = emissionToken.address;
  claimedEmission.amount = claimedAmount;
  claimedEmission.amountUSD = valueInUSD(claimedAmount, Address.fromBytes(emissionToken.address));
  claimedEmission.block = event.block.number;
  claimedEmission.timestamp = event.block.timestamp;
  claimedEmission.dailyUserPoolMetric = dailyUserPoolMetric.id;
  claimedEmission.save();
}
