import { BigDecimal, BigInt, Address, dataSource } from '@graphprotocol/graph-ts';

export let ZERO = BigInt.fromI32(0);
export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');
export let MIN_VIABLE_LIQUIDITY = BigDecimal.fromString('0.01');

export enum TokenBalanceEvent {
  SWAP_IN,
  SWAP_OUT,
  JOIN,
  EXIT,
}

export let ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class AddressByNetwork {
  public mainnet: string;
  public kovan: string;
  public goerli: string;
  public rinkeby: string;
  public polygon: string;
  public fantom: string;
  public arbitrum: string;
  public dev: string;
}

let network: string = dataSource.network();

let vaultAddressByNetwork: AddressByNetwork = {
  mainnet: '0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce',
  kovan: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  goerli: '0x65748E8287Ce4B9E6D83EE853431958851550311',
  rinkeby: '0xF07513C68C55A31337E3b58034b176A15Dce16eD',
  polygon: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  arbitrum: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  dev: '0xa0B05b20e511B1612E908dFCeE0E407E22B76028',
  fantom: '0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce',
};

let wethAddressByNetwork: AddressByNetwork = {
  mainnet: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83', //WFTM
  kovan: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
  goerli: '0x9A1000D492d40bfccbc03f413A48F5B6516Ec0Fd',
  rinkeby: '0x80dD2B80FbcFB06505A301d732322e987380EcD6',
  polygon: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  dev: '0x4CDDb3505Cf09ee0Fa0877061eB654839959B9cd',
  fantom: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83', //WFTM
};

let wbtcAddressByNetwork: AddressByNetwork = {
  mainnet: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
  kovan: '0x1C8E3Bcb3378a443CC591f154c5CE0EBb4dA9648',
  goerli: '0x78dEca24CBa286C0f8d56370f5406B48cFCE2f86',
  rinkeby: '0xb4761d0481B4f7a8A858D2796eEF3DAa2f3D9D2c',
  polygon: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
  arbitrum: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  dev: '0xcD80986f08d776CE41698c47f705CDc99dDBfB0A',
  fantom: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
};

let usdAddressByNetwork: AddressByNetwork = {
  mainnet: '0x04068da6c83afcfa0e13ba15a6696662335d5b75', // USDC
  kovan: '0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115',
  goerli: '0x78dEca24CBa286C0f8d56370f5406B48cFCE2f86',
  rinkeby: '0x70b55Af71B29c5Ca7e67bD1995250364C4bE5554',
  polygon: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  dev: '0x1528f3fcc26d13f7079325fb78d9442607781c8c',
  fantom: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
};

let usdcAddressByNetwork: AddressByNetwork = {
  mainnet: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
  kovan: '0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115',
  goerli: '0x78dEca24CBa286C0f8d56370f5406B48cFCE2f86',
  rinkeby: '0x70b55Af71B29c5Ca7e67bD1995250364C4bE5554',
  polygon: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
  arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  dev: '0x7c0c5AdA758cf764EcD6bAC05b63b2482f90bBB2',
  fantom: '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
};

let usdtAddressByNetwork: AddressByNetwork = {
  mainnet: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
  kovan: '0xcC08220af469192C53295fDd34CFb8DF29aa17AB',
  goerli: '0x78dEca24CBa286C0f8d56370f5406B48cFCE2f86',
  rinkeby: '0x40D26F06DefEe453bCFCAa61Badb16883E4ee26C',
  polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  dev: '0x7c0c5AdA758cf764EcD6bAC05b63b2482f90bBB2',
  fantom: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
};

let balAddressByNetwork: AddressByNetwork = {
  mainnet: '0xf24bcf4d1e507740041c9cfd2dddb29585adce1e', //BEETS
  kovan: '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7',
  goerli: '0x78dEca24CBa286C0f8d56370f5406B48cFCE2f86',
  rinkeby: '0x8850Fd0C65d9B2B168153FAc6bAa269A566c4ef7',
  polygon: '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
  arbitrum: '0x040d1EdC9569d4Bab2D15287Dc5A4F10F56a56B8',
  dev: '0xf702269193081364E355f862f2CFbFCdC5DB738C',
  fantom: '0xf24bcf4d1e507740041c9cfd2dddb29585adce1e', //BEETS
};

let daiAddressByNetwork: AddressByNetwork = {
  mainnet: '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
  kovan: '0x04DF6e4121c27713ED22341E7c7Df330F56f289B',
  goerli: '0x78dEca24CBa286C0f8d56370f5406B48cFCE2f86',
  rinkeby: '0x12c615406F20eDcBDa50888f9fd6734dC4836417',
  polygon: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
  arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  dev: '0x5C0E66606eAbEC1df45E2ADd26C5DF8C0895a397',
  fantom: '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
};

let altDaiAddressByNetwork: AddressByNetwork = {
  mainnet: '0x0000000000000000000000000000000000000000',
  kovan: '0xFf795577d9AC8bD7D90Ee22b6C1703490b6512FD',
  goerli: '0x0000000000000000000000000000000000000000',
  rinkeby: '0x0000000000000000000000000000000000000000',
  polygon: '0x0000000000000000000000000000000000000000',
  arbitrum: '0x0000000000000000000000000000000000000000',
  dev: '0x0000000000000000000000000000000000000000',
  fantom: '0x0000000000000000000000000000000000000000',
};

let altUsdcAddressByNetwork: AddressByNetwork = {
  mainnet: '0x0000000000000000000000000000000000000000',
  kovan: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
  goerli: '0x0000000000000000000000000000000000000000',
  rinkeby: '0x0000000000000000000000000000000000000000',
  polygon: '0x0000000000000000000000000000000000000000',
  arbitrum: '0x0000000000000000000000000000000000000000',
  dev: '0x0000000000000000000000000000000000000000',
  fantom: '0x0000000000000000000000000000000000000000',
};

let altUsdtAddressByNetwork: AddressByNetwork = {
  mainnet: '0x0000000000000000000000000000000000000000',
  kovan: '0x13512979ADE267AB5100878E2e0f485B568328a4',
  goerli: '0x0000000000000000000000000000000000000000',
  rinkeby: '0x0000000000000000000000000000000000000000',
  polygon: '0x0000000000000000000000000000000000000000',
  arbitrum: '0x0000000000000000000000000000000000000000',
  dev: '0x0000000000000000000000000000000000000000',
  fantom: '0x0000000000000000000000000000000000000000',
};

let linearDaiAddressByNetwork: AddressByNetwork = {
  mainnet: '0x2Ff1552Dd09f87d6774229Ee5eca60CF570AE291',
  kovan: '0xfcccb77a946b6a3bd59d149f083b5bfbb8004d6d',
  goerli: '0x0000000000000000000000000000000000000000',
  rinkeby: '0x09EF1F3150E5b88862b051C1B0771b84dcE8001b',
  polygon: '0x0000000000000000000000000000000000000000',
  arbitrum: '0x0000000000000000000000000000000000000000',
  dev: '0x0000000000000000000000000000000000000000',
  fantom: '0x2Ff1552Dd09f87d6774229Ee5eca60CF570AE291',
};

let linearUsdcAddressByNetwork: AddressByNetwork = {
  mainnet: '0x3B998BA87b11a1c5BC1770dE9793B17A0dA61561',
  kovan: '0x0bbd32b14a6503ee20f87df38cf2d5d3b59ea2f5',
  goerli: '0x0000000000000000000000000000000000000000',
  rinkeby: '0x75e29a762c962f4e3D1841d9E7aCe0290BE509ba',
  polygon: '0x0000000000000000000000000000000000000000',
  arbitrum: '0x0000000000000000000000000000000000000000',
  dev: '0x0000000000000000000000000000000000000000',
  fantom: '0x3B998BA87b11a1c5BC1770dE9793B17A0dA61561',
};

let linearUsdtAddressByNetwork: AddressByNetwork = {
  mainnet: '0x0000000000000000000000000000000000000000',
  kovan: '0xe667d48618e71c2a02e4a1b66ed9def1426938b6',
  goerli: '0x0000000000000000000000000000000000000000',
  rinkeby: '0x0000000000000000000000000000000000000000',
  polygon: '0x0000000000000000000000000000000000000000',
  arbitrum: '0x0000000000000000000000000000000000000000',
  dev: '0x0000000000000000000000000000000000000000',
  fantom: '0x0000000000000000000000000000000000000000',
};

function forNetwork(addressByNetwork: AddressByNetwork, network: string): Address {
  if (network == 'mainnet') {
    return Address.fromString(addressByNetwork.mainnet);
  } else if (network == 'kovan') {
    return Address.fromString(addressByNetwork.kovan);
  } else if (network == 'goerli') {
    return Address.fromString(addressByNetwork.goerli);
  } else if (network == 'rinkeby') {
    return Address.fromString(addressByNetwork.rinkeby);
  } else if (network == 'matic') {
    return Address.fromString(addressByNetwork.polygon);
  } else if (network == 'fantom') {
    return Address.fromString(addressByNetwork.fantom);
  } else if (network == 'arbitrum-one') {
    return Address.fromString(addressByNetwork.arbitrum);
  } else {
    return Address.fromString(addressByNetwork.dev);
  }
}

export let VAULT_ADDRESS = forNetwork(vaultAddressByNetwork, network);
export let WETH: Address = forNetwork(wethAddressByNetwork, network);
export let WBTC: Address = forNetwork(wbtcAddressByNetwork, network);
export let USD: Address = forNetwork(usdAddressByNetwork, network);
export let USDC: Address = forNetwork(usdcAddressByNetwork, network);
export let USDT: Address = forNetwork(usdtAddressByNetwork, network);
export let BAL: Address = forNetwork(balAddressByNetwork, network);
export let DAI: Address = forNetwork(daiAddressByNetwork, network);

let ALT_DAI = forNetwork(altDaiAddressByNetwork, network);
let ALT_USDC = forNetwork(altUsdcAddressByNetwork, network);
let ALT_USDT = forNetwork(altUsdtAddressByNetwork, network);
let LINEAR_DAI = forNetwork(linearDaiAddressByNetwork, network);
let LINEAR_USDC = forNetwork(linearUsdcAddressByNetwork, network);
let LINEAR_USDT = forNetwork(linearUsdtAddressByNetwork, network);

export let PRICING_ASSETS: Address[] = [
  WETH,
  WBTC,
  USDC,
  DAI,
  USDT,
  BAL,
  ALT_DAI,
  ALT_USDC,
  ALT_USDT,
  LINEAR_DAI,
  LINEAR_USDC,
  LINEAR_USDT,
];
export let USD_STABLE_ASSETS: Address[] = [USDC, DAI, USDT, ALT_DAI, ALT_USDC, ALT_USDT];
