import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { BondTransactionMonitor } from './services/BondTransactionMonitor';
import { CouponDistributionService } from './services/CouponDistributionService';
import bondsRouter from './routes/bonds';

// Charge les variables d'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const XRPL_URL = process.env.XRPL_URL || 'wss://s.altnet.rippletest.net:51233';
const ISSUER_SEED = process.env.ISSUER_SEED || '';
const WEBHOOK_URL = process.env.WEBHOOK_URL; // URL pour recevoir les notifications

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/bonds', bondsRouter);    // Routes existantes
app.use('/v1/bonds', bondsRouter);     // Nouvelles routes avec /v1 prefix

// Route de santé
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Instances des services
let transactionMonitor: BondTransactionMonitor;
let couponService: CouponDistributionService;

/**
 * Démarre le serveur et les services
 */
async function startServer() {
  try {
    // Connexion à MongoDB
    await connectDB();
    console.log('✅ Base de données connectée');

    // Démarre le serveur Express
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });

    // Démarre le monitoring des transactions XRPL
    transactionMonitor = new BondTransactionMonitor(XRPL_URL, WEBHOOK_URL);
    await transactionMonitor.start();
    console.log('✅ Monitoring des transactions démarré');

    // Configure les listeners pour les événements
    const notifier = transactionMonitor.getNotifier();
    
    notifier.on('transfer', (data) => {
      console.log(`🔔 Événement: Transfert détecté pour ${data.bondName}`);
    });
    
    notifier.on('new_holder', (data) => {
      console.log(`🔔 Événement: Nouveau holder ${data.holderAddress}`);
    });
    
    notifier.on('holder_exit', (data) => {
      console.log(`🔔 Événement: Holder sorti ${data.holderAddress}`);
    });
    
    notifier.on('large_balance', (data) => {
      console.log(`🔔 Événement: Grosse position détectée ${data.percentageOfTotal}%`);
    });

    // Démarre le service de distribution des coupons
    if (ISSUER_SEED) {
      couponService = new CouponDistributionService(ISSUER_SEED, XRPL_URL);
      // Vérifie les paiements toutes les heures
      await couponService.startCronJob(60);
      console.log('✅ Service de distribution des coupons démarré');
    } else {
      console.warn('⚠️  ISSUER_SEED non configuré, le service de coupons ne sera pas démarré');
    }

  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

/**
 * Arrêt propre du serveur
 */
async function gracefulShutdown() {
  console.log('\n🛑 Arrêt du serveur...');
  
  try {
    if (transactionMonitor) {
      await transactionMonitor.stop();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
}

// Gestion des signaux d'arrêt
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Démarrage
startServer();
