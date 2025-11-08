import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/database';
import { Bond } from '../models/Bond';
import { Wallet } from 'xrpl';

dotenv.config();

/**
 * Script pour créer une nouvelle obligation dans la base de données
 */
async function createBond() {
  try {
    await connectDB();

    // Génère un wallet aléatoire pour l'exemple (remplacez par vos vraies valeurs)
    const issuerWallet = Wallet.generate();

    const bondData = {
      bondId: `BOND-${Date.now()}`,
      issuerAddress: issuerWallet.address,
      issuerName: 'Entreprise Example SAS',
      
      // Token MPT (remplacez par votre vrai ID de token après création sur XRPL)
      tokenCurrency: '0000000000000000000000004558414D504C45', // "EXAMPLE" en hex
      tokenName: 'Example Corp 5% 2030',
      totalSupply: '1000000000000', // 1 million de tokens (avec 6 décimales)
      denomination: '1000000', // 1 USDC par token (6 décimales)
      usdcIssuer: 'rN7n7otQDd6FczFgLdlqtyMVrn3HMfgnE1', // Exemple d'issuer USDC
      
      // Conditions
      couponRate: 5.0, // 5% annuel
      couponFrequency: 'quarterly' as const,
      issueDate: Date.now(),
      maturityDate: new Date('2030-12-31').getTime(),
      nextCouponDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).getTime(), // Dans 90 jours
      
      status: 'active' as const,
      description: 'Obligation corporate de la société Example pour financement expansion',
      riskRating: 'BBB+'
    };

    const bond = await Bond.create(bondData);

    console.log('✅ Obligation créée avec succès:');
    console.log(JSON.stringify(bond, null, 2));
    console.log('\n📋 Informations importantes:');
    console.log(`Bond ID: ${bond.bondId}`);
    console.log(`Token Currency: ${bond.tokenCurrency}`);
    console.log(`Issuer Address: ${bond.issuerAddress}`);
    console.log(`Maturity Date: ${new Date(bond.maturityDate).toISOString()}`);

    await disconnectDB();
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'obligation:', error);
    process.exit(1);
  }
}

createBond();
