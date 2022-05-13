import { Address } from '@graphprotocol/graph-ts/index';
import { Token } from '../types/schema';
import { ERC20 } from '../types/Vault/ERC20';

export function createTokenIfNotExist(address: Address, bpToken: boolean): Token {
  let token = Token.load(address);
  if (token === null) {
    const erc20token = ERC20.bind(address);
    token = new Token(address);
    token.address = address;

    let name = '';
    let symbol = '';
    let decimals = 0;

    // attempt to retrieve erc20 values
    let maybeName = erc20token.try_name();
    let maybeSymbol = erc20token.try_symbol();
    let maybeDecimals = erc20token.try_decimals();

    if (!maybeName.reverted) name = maybeName.value;
    if (!maybeSymbol.reverted) symbol = maybeSymbol.value;
    if (!maybeDecimals.reverted) decimals = maybeDecimals.value;

    token.name = name;
    token.symbol = symbol;
    token.decimals = decimals;
    token.bpToken = bpToken;
    token.save();
  }
  return token;
}

export function loadExistingToken(address: Address): Token {
  return Token.load(address) as Token;
}
