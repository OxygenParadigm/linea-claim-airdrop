export class ClaimStatistics {
  private walletsProcessed: number = 0;
  private totalClaimed: number = 0;
  private errorAddresses: string[] = [];

  constructor(private totalWallets: number) {
    this.walletsProcessed = totalWallets;
  }

  public addClaimedAmount(amount: number): void {
    this.totalClaimed += amount;
  }

  public addErrorAddress(address: string): void {
    this.errorAddresses.push(address);
  }

  public logResults(): void {
    console.log('\n=== Claim Process Completed ===');
    console.log(`Total wallets processed: ${this.walletsProcessed}`);
    console.log(`Total Linea claimed: ${this.totalClaimed}`);
    console.log(`Failed wallets: ${this.errorAddresses.length}`);

    if (this.errorAddresses.length > 0) {
      console.log('\nFailed wallets:');
      this.errorAddresses.forEach((address) => console.log(`- ${address}`));
    }
  }
}
