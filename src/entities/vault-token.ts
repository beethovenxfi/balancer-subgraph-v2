import { Address } from '@graphprotocol/graph-ts/index';
import { VaultToken } from '../types/schema';
import { BigDecimal, BigInt, Bytes } from '@graphprotocol/graph-ts';

export function getOrCreateVaultToken(address: Address): VaultToken {
  let vaultToken = VaultToken.load(address);

  if (vaultToken == null) {
    vaultToken = new VaultToken(address);
    vaultToken.token = address;
    vaultToken.tokenAddress = address;
    vaultToken.balance = BigDecimal.zero();
    vaultToken.swapCount = BigInt.zero();
    vaultToken.vault = Bytes.fromI32(2);
    vaultToken.save();
  }
  return vaultToken;
}
