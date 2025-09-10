import delay from 'delay';
import { computeAddress, ethers } from 'ethers';
import PQueue from 'p-queue';
import pRetry from 'p-retry';

import { ClaimStatistics } from './ClaimStatistics';
import { ConfigService } from './ConfigService';
import { GasProvider } from './GasProvider';
import { Config, Mode, UserWallet } from './Interfaces';
import { OdosSwap } from './OdosSwap';
import {
  getERC20Contract,
  randomNumber,
  sendTransaction,
  shuffleArray,
  zeroAddress,
} from './Utils';

const config: Config = ConfigService.loadConfig();
const wallets: UserWallet[] = ConfigService.loadWallets();

const claimStatistics = new ClaimStatistics(wallets.length);

const chainId = 59144;

const fallbackProvider = new ethers.FallbackProvider(
  [...config.rpc_list.map((rpc) => new ethers.JsonRpcProvider(rpc))],
  chainId,
  {
    quorum: 1,
    eventQuorum: 1,
  },
);

const gasProvider = new GasProvider(fallbackProvider);
const odos = new OdosSwap(
  {
    retries: config.retries,
    retryDelay: config.retry_delay_seconds * 1000,
    slippageLimitPercent: config.odos_slippage,
  },
  gasProvider,
  config,
);

const contracts = {
  claim: '0x87baa1694381ae3ecae2660d97fe60404080eb64',
  lineaToken: '0x1789e0043623282D5DCc7F213d703C6D8BAfBB04',
};

export function getClaimContract(runner: ethers.ContractRunner): ethers.Contract {
  const ABI =
    '[{"inputs":[{"internalType":"address","name":"_token","type":"address"},{"internalType":"address","name":"_ownerAddress","type":"address"},{"internalType":"uint256","name":"_claimEnd","type":"uint256"},{"internalType":"address","name":"_primaryFactorAddress","type":"address"},{"internalType":"address","name":"_primaryConditionalMultiplierAddress","type":"address"},{"internalType":"address","name":"_secondaryFactorAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"AllCalculationFactorsZero","type":"error"},{"inputs":[],"name":"AlreadyClaimed","type":"error"},{"inputs":[],"name":"ClaimAmountIsZero","type":"error"},{"inputs":[],"name":"ClaimEndTooShort","type":"error"},{"inputs":[],"name":"ClaimFinished","type":"error"},{"inputs":[],"name":"ClaimNotFinished","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"RenouncingOwnershipDisabled","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"inputs":[],"name":"ZeroAddressNotAllowed","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"address","name":"primaryFactor","type":"address"},{"indexed":false,"internalType":"address","name":"primaryMultiplier","type":"address"},{"indexed":false,"internalType":"address","name":"secondaryFactor","type":"address"},{"indexed":false,"internalType":"uint256","name":"claimEndTimestamp","type":"uint256"}],"name":"AirdropConfigured","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Claimed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferStarted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenBalanceWithdrawn","type":"event"},{"inputs":[],"name":"CLAIM_END","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DENOMINATOR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PRIMARY_CONDITIONAL_MULTIPLIER_ADDRESS","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PRIMARY_FACTOR_ADDRESS","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SECONDARY_FACTOR_ADDRESS","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"TOKEN","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"acceptOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_account","type":"address"}],"name":"calculateAllocation","outputs":[{"internalType":"uint256","name":"tokenAllocation","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"hasClaimed","outputs":[{"internalType":"bool","name":"claimed","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pendingOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}]';
  return new ethers.Contract(contracts.claim, ABI, runner);
}

async function claim(privateKey: string): Promise<void> {
  const wallet = new ethers.Wallet(privateKey, fallbackProvider);
  const contract = getClaimContract(wallet);

  const hasClaimed: boolean = await contract.hasClaimed!(wallet.address);
  if (hasClaimed) {
    console.log(`${wallet.address}: Already claimed, skipping...`);
    return;
  }

  const allocationRaw: bigint = await contract.calculateAllocation!(wallet.address);
  const allocation = Number(ethers.formatEther(allocationRaw));

  if (allocationRaw === 0n) {
    console.log(`${wallet.address}: You are not eligible, skipping...`);
    return;
  }

  const feeData = await gasProvider.waitForGasPrice(
    config.max_gwei_limit,
    config.wait_gwei_timout_minutes * 60 * 1000,
  );

  const tx: ethers.TransactionRequest = {
    to: contracts.claim,
    data: contract.interface.encodeFunctionData('claim'),
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  };

  await sendTransaction(
    wallet,
    tx,
    `Claim LINEA airdrop, allocation: ${allocation}`,
    config.tx_timout_minutes,
  );
  await delay(1000);
  claimStatistics.addClaimedAmount(allocation);
}

async function withdraw(privateKey: string, withdrawAddress: string): Promise<void> {
  const wallet = new ethers.Wallet(privateKey, fallbackProvider);
  const tokenContract = getERC20Contract(contracts.lineaToken, wallet);

  const balanceRaw: bigint = await tokenContract.balanceOf!(wallet.address);
  if (balanceRaw === 0n) {
    console.log(`${wallet.address}: No LINEA balance to withdraw, skipping...`);
    return;
  }

  const balance = Number(ethers.formatEther(balanceRaw));
  await sendTransaction(
    wallet,
    {
      to: contracts.lineaToken,
      data: tokenContract.interface.encodeFunctionData('transfer', [withdrawAddress, balanceRaw]),
    },
    `Withdraw ${balance}LINEA to ${withdrawAddress}`,
  );
}

async function swap(privateKey: string): Promise<void> {
  const wallet = new ethers.Wallet(privateKey, fallbackProvider);
  const tokenContract = getERC20Contract(contracts.lineaToken, wallet);

  const balanceRaw: bigint = await tokenContract.balanceOf!(wallet.address);
  if (balanceRaw === 0n) {
    console.log(`${wallet.address}: No LINEA balance to swap, skipping...`);
    return;
  }

  await odos.swap({
    chainId,
    wallet,
    tokenFrom: contracts.lineaToken,
    tokenTo: zeroAddress,
    rawAmount: balanceRaw,
  });
}

function validateWalletConfiguration(): void {
  if (config.mode === Mode.CLAIM_WITHDRAW) {
    const errorWallets = wallets.filter((wallet) => wallet.withdrawAddress === undefined);
    if (errorWallets.length > 0) {
      throw new Error(`Withdraw address is required for mode: ${Mode.CLAIM_WITHDRAW}`);
    }
  }
}

async function claimSleep(wallet: UserWallet): Promise<void> {
  const seconds = randomNumber(config.claim_delay_seconds);
  console.log(`${computeAddress(wallet.privateKey)}: Sleep for ${seconds}s`);
  await delay(seconds * 1000);
}

async function processWallet(wallet: UserWallet): Promise<void> {
  await claim(wallet.privateKey);

  if (config.mode === Mode.CLAIM_SWAP) {
    await swap(wallet.privateKey);
  }

  if (config.mode === Mode.CLAIM_WITHDRAW) {
    await withdraw(wallet.privateKey, wallet.withdrawAddress!);
  }

  await claimSleep(wallet);
}

async function processWalletWithRetry(wallet: UserWallet): Promise<void> {
  const walletAddress = computeAddress(wallet.privateKey);

  return pRetry(() => processWallet(wallet), {
    retries: config.retries,
    minTimeout: config.retry_delay_seconds * 1000,
    onFailedAttempt: (error) =>
      console.log(
        `${walletAddress}: Processing failed attempt: ${error.message}, retries left: ${error.retriesLeft}`,
      ),
  }).catch((error: Error) => {
    claimStatistics.addErrorAddress(walletAddress);
    console.error(`${walletAddress}: Processing failed - ${error.message}`);
  });
}

async function processAllWallets(): Promise<void> {
  const queue = new PQueue({ concurrency: config.number_of_threads });

  const walletsToProcess = config.shuffle_wallets ? shuffleArray(wallets) : wallets;

  for (const wallet of walletsToProcess) {
    await delay(randomNumber(config.start_delay_seconds) * 1000);
    void queue.add(() => processWalletWithRetry(wallet));
  }

  await queue.onIdle();
}

async function main(): Promise<void> {
  try {
    validateWalletConfiguration();
    await processAllWallets();
    claimStatistics.logResults();
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  setTimeout(() => process.exit(777), 10000);
});
