import { ethers } from 'ethers';

import { getPromiseWithResolvers } from './Utils';

export class GasProvider {
  private readonly POLL_INTERVAL = 30000;
  private readonly POLL_TIMEOUT = 24 * 60 * 60 * 1000;
  private readonly queue: Set<PendingGasPrice>;

  constructor(private readonly provider: ethers.JsonRpcProvider | ethers.FallbackProvider) {
    this.queue = new Set<PendingGasPrice>();
  }

  public async estimateFeesPerGas(
    boostFeePercentage: number = 0,
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const feeData = await this.provider.getFeeData();
    const block = await this.provider.getBlock('latest');
    const baseFee = block?.baseFeePerGas || feeData.gasPrice!;

    const tip = feeData.maxPriorityFeePerGas!;
    const maxFee = feeData.maxFeePerGas!;

    const pct = Math.max(0, boostFeePercentage);
    const boostBps = Math.round(pct * 100);
    const DENOM = 10_000n;
    const NUM = BigInt(10_000 + boostBps);

    const boostedTip = (tip * NUM + (DENOM - 1n)) / DENOM;

    const origHeadroom = (() => {
      const eff = baseFee + tip;
      return maxFee > eff ? maxFee - eff : 0n;
    })();

    const newMaxFee = baseFee + boostedTip + origHeadroom;

    return {
      maxPriorityFeePerGas: boostedTip,
      maxFeePerGas: newMaxFee,
    };
  }

  public async waitForGasPrice(
    maxGwei: number,
    timeout?: number,
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const { promise, resolve, reject } = getPromiseWithResolvers<{
      maxFeePerGas: bigint;
      maxPriorityFeePerGas: bigint;
    }>();

    if (maxGwei === 0) {
      return await this.estimateFeesPerGas();
    }

    this.queue.add({
      resolve,
      reject,
      priceGwei: maxGwei,
      expiredAt: new Date(Date.now() + (timeout || this.POLL_TIMEOUT)),
    });

    if (this.queue.size === 1) {
      void this.pollFeesPrice();
    }

    console.log(`Waiting until the price of gas will be <= ${maxGwei}`);

    return await promise;
  }

  private async pollFeesPrice(): Promise<void> {
    try {
      const items = Array.from(this.queue.values());

      if (items.length === 0) {
        return;
      }

      const gasPrice = await this.estimateFeesPerGas();
      const gasPriceGwei = Number(gasPrice.maxFeePerGas / 10n ** 9n);

      for (const pendingGasPrice of items) {
        if (Date.now() > pendingGasPrice.expiredAt.getTime()) {
          pendingGasPrice.reject(
            new Error(`Timeout waiting for fees price below ${pendingGasPrice.priceGwei}`),
          );
          this.queue.delete(pendingGasPrice);
          continue;
        }

        if (gasPriceGwei <= pendingGasPrice.priceGwei) {
          pendingGasPrice.resolve(gasPrice);
          this.queue.delete(pendingGasPrice);
        }
      }
    } catch (error) {
      console.log(`Poll fees error: ${error}`);
    } finally {
      if (this.queue.size > 0) {
        setTimeout(this.pollFeesPrice.bind(this), this.POLL_INTERVAL);
      }
    }
  }
}

interface PendingGasPrice {
  resolve: (feesPrice: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }) => void;
  reject: (error?: unknown) => void;
  expiredAt: Date;
  priceGwei: number;
}
