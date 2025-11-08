import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Bond } from '../models/Bond';
import { getBondInvestorModel } from '../models/BondInvestor';
import { BondStatsService } from '../services/BondStatsService';
import { requireApiKey } from '../middleware/apiAuth';

const router = express.Router();

/**
 * POST /v1/bonds/submit
 * Route appelée par le front quand "Submission Received!" apparaît
 * Crée/met à jour une obligation et crée la collection holders dédiée
 */
router.post('/submit', requireApiKey, async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Validation minimale : bondId requis
    if (!payload.bondId) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required field: bondId'
      });
    }

    // Mapping exact Front → MongoDB
    const bondData = {
      bondId: payload.bondId,
      issuerName: payload.issuerName,
      contactEmail: payload.contactEmail,
      couponFrequency: payload.couponFrequency,
      totalSupply: payload.totalSupply,
      issuerAddress: payload.issuerAddress,
      issueDate: payload.issueDate,
      maturityDate: payload.maturityDate,
      durationYears: payload.durationYears,
      couponRate: payload.couponRate,
      tokenName: payload.tokenName,
      tokenCurrency: payload.tokenCurrency,
      minimumTicket: payload.minimumTicket,
      status: 'pending',
      // Champs optionnels/par défaut
      denomination: '1',
      description: `Bond ${payload.tokenName || payload.bondId}`,
      stats: {
        totalInvestors: 0,
        totalInvested: '0',
        percentageDistributed: 0,
        totalCouponsPaid: '0'
      }
    };

    // Upsert dans la collection bonds
    const bond = await Bond.findOneAndUpdate(
      { bondId: payload.bondId },
      { $set: bondData },
      { upsert: true, new: true, runValidators: true }
    );

    // Créer la collection holders_<bondId> si elle n'existe pas
    const holdersCollectionName = `holders_${payload.bondId}`;
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Vérifier si la collection existe
    const collections = await db.listCollections({ name: holdersCollectionName }).toArray();
    const collectionExists = collections.length > 0;

    if (!collectionExists) {
      // Créer la collection
      await db.createCollection(holdersCollectionName);
      console.log(`✅ Collection ${holdersCollectionName} créée`);

      // Créer les index
      const collection = db.collection(holdersCollectionName);
      
      // Index unique sur account
      await collection.createIndex({ account: 1 }, { unique: true, name: 'uniq_account' });
      
      // Index sur createdAt
      await collection.createIndex({ createdAt: 1 }, { name: 'idx_createdAt' });
      
      console.log(`✅ Index créés pour ${holdersCollectionName}`);
    } else {
      console.log(`ℹ️  Collection ${holdersCollectionName} existe déjà`);
    }

    // Retourner la réponse
    res.status(200).json({
      ok: true,
      bond: {
        bondId: bond.bondId,
        issuerName: bond.issuerName,
        tokenName: bond.tokenName,
        status: bond.status
      },
      holdersCollection: holdersCollectionName
    });

  } catch (error: any) {
    console.error('Error in /submit:', error);
    res.status(500).json({
      ok: false,
      error: error.message || 'Failed to submit bond'
    });
  }
});

/**
 * GET /api/bonds
 * Liste toutes les obligations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, issuerAddress } = req.query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (issuerAddress) filter.issuerAddress = issuerAddress;

    const bonds = await Bond.find(filter).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: bonds.length,
      data: bonds
    });
  } catch (error) {
    console.error('Error fetching bonds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bonds'
    });
  }
});

/**
 * GET /api/bonds/:bondId
 * Récupère une obligation spécifique avec ses statistiques
 */
router.get('/:bondId', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    
    const bond = await Bond.findOne({ bondId });
    
    if (!bond) {
      return res.status(404).json({
        success: false,
        error: 'Bond not found'
      });
    }

    // Retourne le bond avec ses statistiques intégrées
    res.json({
      success: true,
      data: bond
    });
  } catch (error) {
    console.error('Error fetching bond:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bond'
    });
  }
});

/**
 * POST /api/bonds
 * Crée une nouvelle obligation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const bondData = req.body;
    
    // Validation basique
    if (!bondData.bondId || !bondData.tokenCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: bondId, tokenCurrency'
      });
    }

    // Vérifie que l'obligation n'existe pas déjà
    const existing = await Bond.findOne({
      $or: [
        { bondId: bondData.bondId },
        { tokenCurrency: bondData.tokenCurrency }
      ]
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Bond with this ID or token currency already exists'
      });
    }

    // Initialise les stats
    if (!bondData.stats) {
      bondData.stats = {
        totalInvestors: 0,
        totalInvested: '0',
        percentageDistributed: 0,
        totalCouponsPaid: '0'
      };
    }

    const bond = await Bond.create(bondData);
    
    res.status(201).json({
      success: true,
      data: bond
    });
  } catch (error) {
    console.error('Error creating bond:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bond'
    });
  }
});

/**
 * PATCH /api/bonds/:bondId
 * Met à jour une obligation
 */
router.patch('/:bondId', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    const updates = req.body;

    // Empêche la modification de certains champs critiques
    delete updates.bondId;
    delete updates.tokenCurrency;
    delete updates.issuerAddress;

    const bond = await Bond.findOneAndUpdate(
      { bondId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!bond) {
      return res.status(404).json({
        success: false,
        error: 'Bond not found'
      });
    }

    res.json({
      success: true,
      data: bond
    });
  } catch (error) {
    console.error('Error updating bond:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bond'
    });
  }
});

/**
 * GET /api/bonds/:bondId/investors
 * Liste les investisseurs d'une obligation spécifique (nouveau système)
 */
router.get('/:bondId/investors', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    const { minPercentage, sortBy = 'percentage', order = 'desc' } = req.query;

    // Vérifie que l'obligation existe
    const bond = await Bond.findOne({ bondId });
    if (!bond) {
      return res.status(404).json({
        success: false,
        error: 'Bond not found'
      });
    }

    // Récupère le modèle d'investisseurs pour cette obligation
    const InvestorModel = getBondInvestorModel(bondId);
    
    const filter: any = {};
    if (minPercentage) {
      filter.percentage = { $gte: Number(minPercentage) };
    }

    const sortOrder = order === 'desc' ? -1 : 1;
    const investors = await InvestorModel.find(filter)
      .sort({ [sortBy as string]: sortOrder });

    res.json({
      success: true,
      bondId,
      count: investors.length,
      data: investors
    });
  } catch (error) {
    console.error('Error fetching investors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch investors'
    });
  }
});

/**
 * POST /api/bonds/:bondId/investors
 * Ajoute un investisseur test (pour développement uniquement)
 */
router.post('/:bondId/investors', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    const { investorAddress, balance, investedAmount } = req.body;

    if (!investorAddress || !balance) {
      return res.status(400).json({
        success: false,
        error: 'investorAddress and balance are required'
      });
    }

    const bond = await Bond.findOne({ bondId });
    if (!bond) {
      return res.status(404).json({
        success: false,
        error: 'Bond not found'
      });
    }

    const InvestorModel = getBondInvestorModel(bondId);
    
    // Calcule le pourcentage
    const balanceNum = BigInt(balance);
    const totalSupplyNum = BigInt(bond.totalSupply);
    const percentage = Number((balanceNum * BigInt(10000)) / totalSupplyNum) / 100;

    // Crée l'investisseur
    const investor = await InvestorModel.create({
      investorAddress,
      balance,
      percentage,
      investedAmount: investedAmount || balance,
      transactionHistory: [],
      totalCouponsReceived: '0'
    });

    // Met à jour les stats de l'obligation
    await BondStatsService.updateBondStats(bondId);

    res.json({
      success: true,
      message: 'Investor added successfully',
      data: investor
    });
  } catch (error) {
    console.error('Error adding investor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add investor'
    });
  }
});

/**
 * GET /api/bonds/:bondId/investors/:address
 * Récupère un investisseur spécifique
 */
router.get('/:bondId/investors/:address', async (req: Request, res: Response) => {
  try {
    const { bondId, address } = req.params;

    const InvestorModel = getBondInvestorModel(bondId);
    const investor = await InvestorModel.findOne({ investorAddress: address });

    if (!investor) {
      return res.status(404).json({
        success: false,
        error: 'Investor not found'
      });
    }

    res.json({
      success: true,
      data: investor
    });
  } catch (error) {
    console.error('Error fetching investor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch investor'
    });
  }
});

/**
 * GET /api/bonds/:bondId/stats
 * Récupère les statistiques détaillées d'une obligation
 */
router.get('/:bondId/stats', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;

    const stats = await BondStatsService.getBondDetailedStats(bondId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching bond stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch bond stats'
    });
  }
});

/**
 * GET /api/bonds/:bondId/holders (ancienne route, redirige vers investors)
 * @deprecated Utiliser /api/bonds/:bondId/investors à la place
 */
router.get('/:bondId/holders', async (req: Request, res: Response) => {
  // Redirige vers la nouvelle route
  return res.redirect(301, `/api/bonds/${req.params.bondId}/investors`);
});

/**
 * GET /api/bonds/:bondId/transactions
 * Liste l'historique des transactions depuis les investisseurs
 */
router.get('/:bondId/transactions', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    const { type, limit = 100, offset = 0 } = req.query;

    const InvestorModel = getBondInvestorModel(bondId);
    const investors = await InvestorModel.find({});

    // Collecte toutes les transactions de tous les investisseurs
    let allTransactions: any[] = [];
    for (const investor of investors) {
      if (investor.transactionHistory) {
        investor.transactionHistory.forEach(tx => {
          allTransactions.push({
            type: tx.type,
            amount: tx.amount,
            txHash: tx.txHash,
            timestamp: tx.timestamp,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            investorAddress: investor.investorAddress
          });
        });
      }
    }

    // Filtre par type si demandé
    if (type) {
      allTransactions = allTransactions.filter(tx => tx.type === type);
    }

    // Trie par timestamp décroissant
    allTransactions.sort((a, b) => b.timestamp - a.timestamp);

    // Pagination
    const start = Number(offset);
    const end = start + Number(limit);
    const paginatedTransactions = allTransactions.slice(start, end);

    res.json({
      success: true,
      count: paginatedTransactions.length,
      total: allTransactions.length,
      data: paginatedTransactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions'
    });
  }
});

/**
 * GET /api/bonds/:bondId/coupons
 * Liste les paiements de coupons reçus par les investisseurs
 */
router.get('/:bondId/coupons', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;

    const InvestorModel = getBondInvestorModel(bondId);
    const investors = await InvestorModel.find({});

    // Collecte les coupons de tous les investisseurs
    const couponPayments = investors
      .filter(inv => inv.transactionHistory && inv.transactionHistory.length > 0)
      .flatMap(inv => 
        inv.transactionHistory
          .filter(tx => tx.type === 'coupon')
          .map(tx => ({
            investorAddress: inv.investorAddress,
            amount: tx.amount,
            txHash: tx.txHash,
            timestamp: tx.timestamp,
            totalReceived: inv.totalCouponsReceived
          }))
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      success: true,
      count: couponPayments.length,
      data: couponPayments
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coupons'
    });
  }
});

/**
 * POST /api/bonds/:bondId/coupons/schedule
 * Planifie le prochain paiement de coupon
 */
router.post('/:bondId/coupons/schedule', async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    
    // Cette route nécessite d'importer le CouponDistributionService
    // Pour l'instant, retourne une réponse simple
    res.json({
      success: true,
      message: 'Use the CouponDistributionService.scheduleCouponPayment() method'
    });
  } catch (error) {
    console.error('Error scheduling coupon:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule coupon'
    });
  }
});

/**
 * GET /api/holders/:address/bonds
 * Récupère les obligations détenues par une adresse
 */
router.get('/holders/:address/bonds', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Récupère toutes les bonds
    const allBonds = await Bond.find({});
    
    // Pour chaque bond, vérifie si l'adresse est investisseur
    const holdings = [];
    
    for (const bond of allBonds) {
      const InvestorModel = getBondInvestorModel(bond.bondId);
      const investor = await InvestorModel.findOne({ investorAddress: address });
      
      if (investor) {
        holdings.push({
          bondId: bond.bondId,
          holderAddress: address,
          balance: investor.balance,
          percentage: investor.percentage,
          investedAmount: investor.investedAmount,
          totalCouponsReceived: investor.totalCouponsReceived,
          bond: {
            tokenName: bond.tokenName,
            couponRate: bond.couponRate,
            maturityDate: bond.maturityDate,
            status: bond.status
          }
        });
      }
    }

    res.json({
      success: true,
      count: holdings.length,
      data: holdings
    });
  } catch (error) {
    console.error('Error fetching holder bonds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch holder bonds'
    });
  }
});

export default router;
