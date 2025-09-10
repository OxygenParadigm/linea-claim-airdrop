import { ethers } from 'ethers';

export interface UserWallet {
  privateKey: string;
  withdrawAddress?: string;
}

export enum Mode {
  CLAIM = 'claim',
  CLAIM_WITHDRAW = 'claim_withdraw',
  CLAIM_SWAP = 'claim_swap',
}

export interface Config {
  mode: Mode;
  rpc_list: string[];
  number_of_threads: number;
  start_delay_seconds: [number, number];
  claim_delay_seconds: [number, number];
  retries: number;
  shuffle_wallets: boolean;
  retry_delay_seconds: number;
  odos_slippage: number;
  max_gwei_limit: number;
  wait_gwei_timout_minutes: number;
  boost_max_priority_fee_percentage: number;
  tx_timout_minutes: number;
}

export interface SwapConfig {
  slippageLimitPercent: number;
  retries: number;
  retryDelay: number;
}

export interface SwapParams {
  wallet: ethers.Wallet;
  tokenFrom: string;
  tokenTo: string;
  chainId: number;
  rawAmount: bigint;
}

export interface SwapService {
  swap(params: SwapParams): Promise<void>;
  getSupportedChains(): number[];
  isSupport(chainId: number): boolean;
}
