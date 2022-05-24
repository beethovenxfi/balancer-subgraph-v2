import { Address } from '@graphprotocol/graph-ts/index';
import { DailyUserMetric, DailyUserPoolMetric, LifetimeUserMetric, User } from '../types/schema';
import { BigDecimal, Bytes, ethereum } from '@graphprotocol/graph-ts';

export function getOrCreateUser(address: Address): User {
  let user = User.load(address);
  if (user === null) {
    user = new User(address);
    user.address = address;
    user.save();
  }
  return user;
}

export function getOrCreateLifetimeUserMetric(address: Address): LifetimeUserMetric {
  let lifetimeUserMetric = LifetimeUserMetric.load(address);
  if (lifetimeUserMetric === null) {
    lifetimeUserMetric = new LifetimeUserMetric(address);
    lifetimeUserMetric.userAddress = address;
    lifetimeUserMetric.swapVolume = BigDecimal.zero();
    lifetimeUserMetric.invested = BigDecimal.zero();
    lifetimeUserMetric.withdrawn = BigDecimal.zero();
    lifetimeUserMetric.claimedEmissions = BigDecimal.zero();
    lifetimeUserMetric.save();
  }
  return lifetimeUserMetric;
}

export function getOrCreateDailyUserMetric(address: Address, block: ethereum.Block): DailyUserMetric {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = address.concatI32(dayId);
  let dailyUserMetric = DailyUserMetric.load(id);
  if (dailyUserMetric == null) {
    dailyUserMetric = new DailyUserMetric(id);
    dailyUserMetric.user = address;
    dailyUserMetric.userAddress = address;
    dailyUserMetric.day = dayId;
    dailyUserMetric.startTime = dayId * 86400;
    dailyUserMetric.swapVolume = BigDecimal.zero();
    dailyUserMetric.invested = BigDecimal.zero();
    dailyUserMetric.withdrawn = BigDecimal.zero();
    dailyUserMetric.claimedEmissions = BigDecimal.zero();
    dailyUserMetric.save();
  }
  return dailyUserMetric;
}

export function getOrCreateDailyUserPoolMetric(
  userAddress: Address,
  poolId: Bytes,
  block: ethereum.Block
): DailyUserPoolMetric {
  let timestamp = block.timestamp.toI32();
  const dayId = timestamp / 86400;
  const id = userAddress.concat(poolId).concatI32(dayId);
  let dailyUserPoolMetric = DailyUserPoolMetric.load(id);
  if (dailyUserPoolMetric == null) {
    dailyUserPoolMetric = new DailyUserPoolMetric(id);
    dailyUserPoolMetric.user = userAddress;
    dailyUserPoolMetric.userAddress = userAddress;
    dailyUserPoolMetric.pool = poolId;
    dailyUserPoolMetric.poolId = poolId;
    dailyUserPoolMetric.day = dayId;
    dailyUserPoolMetric.startTime = dayId * 86400;
    dailyUserPoolMetric.totalShares = BigDecimal.zero();
    dailyUserPoolMetric.swapVolume = BigDecimal.zero();
    dailyUserPoolMetric.invested = BigDecimal.zero();
    dailyUserPoolMetric.withdrawn = BigDecimal.zero();
    dailyUserPoolMetric.save();
  }
  return dailyUserPoolMetric;
}
