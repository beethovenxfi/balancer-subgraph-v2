import { BigDecimal, BigInt, Address, dataSource } from '@graphprotocol/graph-ts';

import { assets } from './assets';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ProtocolFeeType {
  export const Swap = 0;
  export const FlashLoan = 1;
  export const Yield = 2;
  export const Aum = 3;
}

export let ZERO = BigInt.fromI32(0);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');
export const SWAP_IN = 0;
export const SWAP_OUT = 1;

export let ZERO_ADDRESS = Address.fromString('0x0000000000000000000000000000000000000000');

export let MIN_POOL_LIQUIDITY = BigDecimal.fromString('2000');
export let MIN_SWAP_VALUE_USD = BigDecimal.fromString('1');

export let USD_STABLE_ASSETS = assets.stableAssets;
export let PRICING_ASSETS = assets.stableAssets.concat(assets.pricingAssets);

class AddressByNetwork {
  public mainnet: string;
  public goerli: string;
  public polygon: string;
  public arbitrum: string;
  public optimism: string;
  public fantom: string;
  public dev: string;
}

let network: string = dataSource.network();

let vaultAddressByNetwork: AddressByNetwork = {
  mainnet: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  goerli: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  polygon: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  arbitrum: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  optimism: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  fantom: '0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce',
  dev: '0xa0B05b20e511B1612E908dFCeE0E407E22B76028',
};

let protocolFeeCollectorAddressByNetwork: AddressByNetwork = {
  mainnet: '0xce88686553686da562ce7cea497ce749da109f9f',
  goerli: '0xce88686553686da562ce7cea497ce749da109f9f',
  polygon: '0xce88686553686da562ce7cea497ce749da109f9f',
  arbitrum: '0xce88686553686da562ce7cea497ce749da109f9f',
  optimism: '0xce88686553686da562ce7cea497ce749da109f9f',
  fantom: '0xc6920d3a369e7c8bd1a22dbe385e11d1f7af948f',
  dev: '0xce88686553686da562ce7cea497ce749da109f9f',
};

function forNetwork(addressByNetwork: AddressByNetwork, network: string): Address {
  if (network == 'mainnet') {
    return Address.fromString(addressByNetwork.mainnet);
  } else if (network == 'goerli') {
    return Address.fromString(addressByNetwork.goerli);
  } else if (network == 'matic') {
    return Address.fromString(addressByNetwork.polygon);
  } else if (network == 'arbitrum-one') {
    return Address.fromString(addressByNetwork.arbitrum);
  } else if (network == 'optimism') {
    return Address.fromString(addressByNetwork.optimism);
  } else if (network == 'fantom') {
    return Address.fromString(addressByNetwork.fantom);
  } else {
    return Address.fromString(addressByNetwork.dev);
  }
}

export let VAULT_ADDRESS = forNetwork(vaultAddressByNetwork, network);
export let PROTOCOL_FEE_COLLECTOR_ADDRESS = forNetwork(protocolFeeCollectorAddressByNetwork, network);
