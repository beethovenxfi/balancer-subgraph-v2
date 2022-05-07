import { Address } from '@graphprotocol/graph-ts/index';
import { Token } from '../types/schema';
import { ERC20 } from '../types/Vault/ERC20';

export function getToken(address: Address): Token {
  let token = Token.load(address);

  if (token == null) {
    let tokenContract = ERC20.bind(address);
    token = new Token(address);
    token.address = address;
    token.name = tokenContract.name();
    token.symbol = tokenContract.symbol();
    token.decimals = tokenContract.decimals();
    token.save();
  }

  return token;
}
