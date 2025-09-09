import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import pRetry from 'p-retry';

import { SwapConfig, SwapParams, SwapService } from './Interfaces';
import { approve, sendTransaction, zeroAddress } from './Utils';

export class OdosSwap implements SwapService {
  private readonly axiosInstance: AxiosInstance;

  private readonly supportedChains: number[] = [
    1, 137, 42161, 10, 56, 8453, 43114, 250, 324, 534352, 34443, 59144, 5000, 130, 146, 252,
  ];

  constructor(private readonly swapConfig: SwapConfig) {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.odos.xyz',
    });
  }

  public async swap(params: SwapParams): Promise<void> {
    await pRetry(() => this.executeSwap(params), {
      retries: this.swapConfig.retries,
      factor: 1.5,
      minTimeout: this.swapConfig.retryDelay,
      onFailedAttempt: (error) => {
        console.log(`Swap attempt ${error.attemptNumber} failed: ${error.message}`);
        if (error.attemptNumber < this.swapConfig.retries + 1) {
          console.log(`Retrying... (${error.retriesLeft} attempts left)`);
        }
      },
    });
  }

  public getSupportedChains(): number[] {
    return this.supportedChains;
  }

  public isSupport(chainId: number): boolean {
    return this.supportedChains.includes(chainId);
  }

  private async executeSwap(params: SwapParams): Promise<void> {
    const { wallet, tokenFrom, tokenTo, chainId, rawAmount } = params;

    const routerAddress = await this.getContractInfo(chainId);

    if (tokenFrom !== zeroAddress) {
      await approve(wallet, tokenFrom, routerAddress, rawAmount);
    }

    const quote = await this.getQuote({
      chainId: chainId,
      inputTokens: [
        {
          tokenAddress: tokenFrom,
          amount: rawAmount.toString(),
        },
      ],
      outputTokens: [
        {
          tokenAddress: tokenTo,
          proportion: 1,
        },
      ],
      userAddr: wallet.address,
      slippageLimitPercent: this.swapConfig.slippageLimitPercent,
      simple: true,
    });

    const odosTransaction = await this.assembleQuote({
      userAddr: wallet.address,
      pathId: quote.pathId,
      simulate: true,
    });

    this.validateSimulation(odosTransaction, tokenFrom, tokenTo);

    await sendTransaction(
      wallet,
      odosTransaction.transaction,
      `Odos swap LINEA -> ETH, amount: ${ethers.formatEther(rawAmount)}`,
    );
  }

  private validateSimulation(
    odosTransaction: OdosTransaction,
    tokenFrom: string,
    tokenTo: string,
  ): void {
    const simulation = odosTransaction.simulation;

    if (!simulation) {
      throw new Error('Simulation data is missing');
    }

    if (!simulation.isSuccess) {
      throw new Error(
        `Simulation failed for ${tokenFrom.toString()} -> ${tokenTo.toString()}: ${JSON.stringify(simulation.simulationError)}`,
      );
    }

    if (simulation.amountsOut && simulation.amountsOut.length > 0) {
      const outputAmount = simulation.amountsOut[0];
      if (!outputAmount || outputAmount <= 0) {
        throw new Error(`Invalid simulation output amount: ${outputAmount}`);
      }
    }
  }

  private async getContractInfo(chainId: number): Promise<string> {
    const response = await this.axiosInstance.get(
      `https://api.odos.xyz/info/contract-info/v3/${chainId}`,
    );

    return response.data.routerAddress;
  }

  private async getQuote(payload: QuotePayload): Promise<Quote> {
    const response = await this.axiosInstance.post('/sor/quote/v3', payload);
    return response.data;
  }

  private async assembleQuote(payload: AssembleQuotePayload): Promise<OdosTransaction> {
    const response = await this.axiosInstance.post('/sor/assemble', payload);
    return response.data;
  }
}

interface QuotePayload {
  chainId: number;
  inputTokens: Array<{
    tokenAddress: string;
    amount: string;
  }>;
  outputTokens: Array<{
    tokenAddress: string;
    proportion: number;
  }>;
  gasPrice?: number;
  slippageLimitPercent?: number;
  sourceBlacklist?: Array<unknown>;
  pathViz?: boolean;
  referralCode?: number;
  compact?: boolean;
  likeAsset?: boolean;
  disableRFQs?: boolean;
  userAddr?: string;
  referralFee?: number;
  referralFeeRecipient?: string;
  simple?: boolean;
}

interface AssembleQuotePayload {
  userAddr: string;
  pathId: string;
  simulate?: boolean;
  receiver?: string;
}

interface Quote {
  inTokens: Array<string>;
  outTokens: Array<string>;
  inAmounts: Array<string>;
  outAmounts: Array<string>;
  gasEstimate: number;
  dataGasEstimate: number;
  gweiPerGas: number;
  gasEstimateValue: number;
  inValues: Array<number>;
  outValues: Array<number>;
  netOutValue: number;
  priceImpact: number;
  percentDiff: number;
  permit2Message: unknown;
  permit2Hash: unknown;
  pathId: string;
  pathViz: {
    nodes: Array<{
      name: string;
      symbol: string;
      decimals: number;
      visible: boolean;
      width: number;
    }>;
    links: Array<{
      source: number;
      target: number;
      sourceExtend: boolean;
      targetExtend: boolean;
      label: string;
      value: number;
      nextValue: number;
      stepValue: number;
      in_value: number;
      out_value: number;
      edge_len: number;
      sourceToken: {
        name: string;
        symbol: string;
        decimals: number;
        asset_id: string;
        asset_type: string;
        is_rebasing: boolean;
        cgid: string;
      };
      targetToken: {
        name: string;
        symbol: string;
        decimals: number;
        asset_id: string;
        asset_type: string;
        is_rebasing: boolean;
        cgid: string;
      };
    }>;
  };
  blockNumber: number;
}

interface OdosTransaction {
  deprecated: unknown;
  traceId: string;
  blockNumber: number;
  gasEstimate: number;
  gasEstimateValue: number;
  inputTokens: Array<{
    tokenAddress: string;
    amount: string;
  }>;
  outputTokens: Array<{
    tokenAddress: string;
    amount: string;
  }>;
  netOutValue: number;
  outValues: Array<string>;
  transaction: {
    gas: number;
    gasPrice: number;
    value: string;
    to: string;
    from: string;
    data: string;
    nonce: number;
    chainId: number;
  };
  simulation: {
    isSuccess: boolean;
    amountsOut: Array<number>;
    gasEstimate: number;
    simulationError: unknown;
  };
}
