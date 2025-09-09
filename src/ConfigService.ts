import fs from 'node:fs';
import path from 'node:path';

import { ethers } from 'ethers';
import { parse } from 'jsonc-parser';

import { Config, UserWallet } from './Interfaces';

export class ConfigService {
  static loadConfig(): Config {
    try {
      const configPath = path.resolve(process.cwd(), 'config', 'config.json');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = parse(configContent);
      this.validateConfig(config);
      return config;
    } catch (error) {
      throw new Error(`Failed to load config: ${(error as Error).message}`);
    }
  }

  static loadWallets(): UserWallet[] {
    const rawList = this.parseTextFile(path.resolve(process.cwd(), 'config', 'wallets.txt'));

    if (rawList.length === 0) {
      throw new Error('No wallets found in wallets.txt');
    }

    return rawList.map((rawItem, index) => this.parseWalletEntry(rawItem, index));
  }

  private static validateConfig(config: any): void {
    const requiredFields = [
      'rpc_list',
      'retries',
      'retry_delay_seconds',
      'odos_slippage',
      'number_of_threads',
      'start_delay_seconds',
      'mode',
    ];
    const missingFields = requiredFields.filter((field) => !(field in config));

    if (missingFields.length > 0) {
      throw new Error(`Missing required config fields: ${missingFields.join(', ')}`);
    }

    if (!Array.isArray(config.rpc_list) || config.rpc_list.length === 0) {
      throw new Error('rpc_list must be a non-empty array');
    }
  }

  private static parseWalletEntry(rawItem: string, index: number): UserWallet {
    let [privateKey, withdrawAddress] = rawItem.split(':');

    if (privateKey && !privateKey.startsWith('0x')) {
      privateKey = `0x${privateKey}`;
    }

    if (!privateKey || !ethers.isHexString(privateKey, 32)) {
      throw new Error(`Invalid private key at line ${index + 1}`);
    }

    if (withdrawAddress && !ethers.isAddress(withdrawAddress)) {
      throw new Error(`Invalid withdraw address: ${withdrawAddress} at line ${index + 1}`);
    }

    return { privateKey, withdrawAddress };
  }

  private static parseTextFile(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.trim().length === 0) {
        return [];
      }

      return content
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${(error as Error).message}`);
    }
  }
}
