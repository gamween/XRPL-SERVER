import { Client, Wallet, xrpToDrops } from 'xrpl';
import { Bond } from '../models/Bond';
import { getBondInvestorModel } from '../models/BondInvestor';
import { BondStatsService } from './BondStatsService';

/**
 * Service de distribution des coupons aux détenteurs d'obligations
 */
export class CouponDistributionService {
  private client: Client;
  private issuerWallet: Wallet;

  constructor(
    issuerSeed: string,
    xrplUrl: string = 'wss://s.altnet.rippletest.net:51233'
  ) {
    this.client = new Client(xrplUrl);
    this.issuerWallet = Wallet.fromSeed(issuerSeed);
  }

  /**
   * Calcule le prochain paiement de coupon pour une obligation
   */
  calculateNextCouponDate(bond: any): number {
    const currentDate = Date.now();
    let nextDate = bond.nextCouponDate;

    // Si la date est passée, calcule la prochaine
    while (nextDate <= currentDate) {
      nextDate = this.addPeriod(nextDate, bond.couponFrequency);
    }

    return nextDate;
  }

  /**
   * Ajoute une période à une date
   */
  private addPeriod(timestamp: number, frequency: string): number {
    const date = new Date(timestamp);
    
    switch (frequency) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'semi-annual':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'annual':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    
    return date.getTime();
  }

  /**
   * Planifie tous les paiements de coupons à venir
   */
  async scheduleAllCouponPayments(): Promise<void> {
    try {
      const activeBonds = await Bond.find({ status: 'active' });
      
      console.log(`📅 Planification des coupons pour ${activeBonds.length} obligation(s)...`);

      for (const bond of activeBonds) {
        await this.scheduleCouponPayment(bond.bondId);
      }

      console.log('✅ Planification terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la planification:', error);
      throw error;
    }
  }

  /**
   * Planifie le prochain paiement de coupon pour une obligation
   */
  async scheduleCouponPayment(bondId: string): Promise<void> {
    try {
      const bond = await Bond.findOne({ bondId });
      if (!bond) {
        throw new Error(`Obligation ${bondId} introuvable`);
      }

      // Récupère tous les investisseurs actuels
      const InvestorModel = getBondInvestorModel(bondId);
      const investors = await InvestorModel.find({});
      
      if (investors.length === 0) {
        console.log(`⚠️  Aucun investisseur pour ${bond.tokenName}, paiement ignoré`);
        return;
      }

      // Calcule le montant du coupon par token
      const denominationNum = BigInt(bond.denomination);
      const couponPerToken = (denominationNum * BigInt(Math.floor(bond.couponRate * 100))) / BigInt(10000);

      // Calcule les montants pour chaque investisseur
      const recipients = investors.map(investor => {
        const balanceNum = BigInt(investor.balance);
        const amount = (balanceNum * couponPerToken) / BigInt(1000000); // Ajuste selon la précision
        
        return {
          investorAddress: investor.investorAddress,
          balance: investor.balance,
          amount: amount.toString()
        };
      });

      const totalAmount = recipients.reduce(
        (sum, r) => sum + BigInt(r.amount),
        BigInt(0)
      );

      console.log(`✅ Coupon prêt pour ${bond.tokenName} - ${recipients.length} destinataire(s) - Total: ${totalAmount.toString()}`);
    } catch (error) {
      console.error('❌ Erreur lors de la planification du coupon:', error);
      throw error;
    }
  }

  /**
   * Soustrait une période à une date
   */
  private subtractPeriod(timestamp: number, frequency: string): number {
    const date = new Date(timestamp);
    
    switch (frequency) {
      case 'monthly':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() - 3);
        break;
      case 'semi-annual':
        date.setMonth(date.getMonth() - 6);
        break;
      case 'annual':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    
    return date.getTime();
  }

  /**
   * Exécute les paiements de coupons dus pour une obligation
   */
  async executeScheduledPayments(bondId: string): Promise<void> {
    try {
      await this.client.connect();
      console.log('✅ Connecté au XRPL pour les paiements');

      const bond = await Bond.findOne({ bondId });
      if (!bond) {
        throw new Error(`Obligation ${bondId} introuvable`);
      }

      console.log(`💰 Exécution du paiement de coupon pour ${bond.tokenName}`);

      await this.executeCouponPayment(bondId);

      await this.client.disconnect();
      console.log('✅ Paiements terminés');
    } catch (error) {
      console.error('❌ Erreur lors de l\'exécution des paiements:', error);
      await this.client.disconnect();
      throw error;
    }
  }

  /**
   * Exécute un paiement de coupon pour une obligation
   */
  async executeCouponPayment(bondId: string): Promise<void> {
    const bond = await Bond.findOne({ bondId });
    if (!bond) {
      throw new Error(`Obligation ${bondId} introuvable`);
    }

    console.log(`💸 Exécution du paiement pour ${bond.tokenName}...`);

    try {
      const InvestorModel = getBondInvestorModel(bondId);
      const investors = await InvestorModel.find({});

      if (investors.length === 0) {
        console.log('⚠️  Aucun investisseur, paiement ignoré');
        return;
      }

      // Calcule le montant du coupon par token
      const denominationNum = BigInt(bond.denomination);
      const couponPerToken = (denominationNum * BigInt(Math.floor(bond.couponRate * 100))) / BigInt(10000);

      const txHashes: string[] = [];
      let totalPaid = BigInt(0);

      // Envoie les paiements à chaque investisseur
      for (const investor of investors) {
        try {
          const balanceNum = BigInt(investor.balance);
          const amount = (balanceNum * couponPerToken) / BigInt(1000000);
          
          console.log(`  → Paiement de ${amount} USDC à ${investor.investorAddress}...`);

          const prepared = await this.client.autofill({
            TransactionType: 'Payment',
            Account: this.issuerWallet.address,
            Destination: investor.investorAddress,
            Amount: {
              currency: 'USD',
              value: (BigInt(amount) / BigInt(1000000)).toString(),
              issuer: this.issuerWallet.address
            },
            Memos: [{
              Memo: {
                MemoType: Buffer.from('coupon_payment', 'utf8').toString('hex').toUpperCase(),
                MemoData: Buffer.from(`Bond: ${bond.tokenName}`, 'utf8').toString('hex').toUpperCase()
              }
            }]
          });

          const signed = this.issuerWallet.sign(prepared);
          const result = await this.client.submitAndWait(signed.tx_blob);

          if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
            const meta = result.result.meta as { TransactionResult: string };
            if (meta.TransactionResult === 'tesSUCCESS') {
              txHashes.push(result.result.hash);
              totalPaid += amount;

              // Enregistre la transaction dans l'historique de l'investisseur
              investor.transactionHistory.push({
                type: 'coupon',
                amount: amount.toString(),
                txHash: result.result.hash,
                timestamp: Date.now(),
                fromAddress: this.issuerWallet.address,
                toAddress: investor.investorAddress
              });

              investor.totalCouponsReceived = (
                BigInt(investor.totalCouponsReceived) + amount
              ).toString();

              await investor.save();

              console.log(`    ✅ Paiement réussi (${result.result.hash})`);
            } else {
              console.error(`    ❌ Paiement échoué: ${meta.TransactionResult}`);
            }
          }
        } catch (error) {
          console.error(`    ❌ Erreur lors du paiement à ${investor.investorAddress}:`, error);
        }
      }

      // Met à jour les stats de l'obligation
      bond.stats.totalCouponsPaid = (
        BigInt(bond.stats.totalCouponsPaid) + totalPaid
      ).toString();
      await bond.save();

      console.log(`✅ Paiement complété - Total: ${totalPaid.toString()}`);
    } catch (error) {
      console.error('❌ Erreur lors du paiement:', error);
      throw error;
    }
  }

  /**
   * Vérifie et exécute les paiements en boucle (cron-like)
   */
  async startCronJob(intervalMinutes: number = 60): Promise<void> {
    console.log(`⏰ Démarrage du cron job (vérification toutes les ${intervalMinutes} minutes)`);
    
    const check = async () => {
      try {
        console.log('🔍 Vérification des paiements dus...');
        
        // Récupère toutes les obligations actives
        const activeBonds = await Bond.find({ status: 'active' });
        
        for (const bond of activeBonds) {
          await this.executeScheduledPayments(bond.bondId);
        }
      } catch (error) {
        console.error('❌ Erreur dans le cron job:', error);
      }
    };

    // Première exécution immédiate
    await check();

    // Puis répète à intervalle régulier
    setInterval(check, intervalMinutes * 60 * 1000);
  }
}
