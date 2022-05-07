import { Address } from '@graphprotocol/graph-ts/index';
import { User } from '../types/schema';

export function getUser(address: Address): User {
  let user = User.load(address);
  if (user === null) {
    user = new User(address);
    user.address = address;
    user.save();
  }
  return user;
}
