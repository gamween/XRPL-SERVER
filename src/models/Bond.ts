import mongoose, { Schema, Document } from 'mongoose';

/**
 * Interface pour une obligation émise
 * Table unique qui répertorie toutes les obligations
 */
export interface IBond extends Document {
  bondId: string;                    // ID unique de l'obligation
  issuerAddress: string;             // Adresse XRPL de l'émetteur
  issuerName: string;                // Nom de l'entreprise émettrice
  contactEmail: string;              // Email de contact de l'émetteur

  // Informations du token
  tokenCurrency: string;             // Code du token MPT sur XRPL (hex)
  tokenName: string;                 // Nom lisible du token
  totalSupply: string;               // Nombre total de tokens émis
  denomination: string;              // Valeur nominale par token (pour calcul des coupons)
  minimumTicket?: number;            // Investissement minimum requis (optionnel)
  
  // Conditions financières
  couponRate: number;                // Taux du coupon (ex: 5 pour 5% ou 0.07 pour 7%)
  couponFrequency: string;           // 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', etc.
  maturityDate: string;              // Date d'échéance (ISO string ou timestamp)
  issueDate: string;                 // Date d'émission (ISO string ou timestamp)
  durationYears: number;             // Durée en années
  
  // Statut et métadonnées
  status: 'pending' | 'active' | 'matured' | 'defaulted' | 'cancelled';
  description?: string;
  riskRating?: string;               // AAA, AA, A, BBB, etc.
  
  // Statistiques (calculées et mises à jour automatiquement)
  stats: {
    totalInvestors: number;          // Nombre total d'investisseurs
    totalInvested: string;           // Montant total investi (en tokens)
    percentageDistributed: number;   // % du totalSupply distribué
    lastTransactionDate?: number;    // Dernière transaction
    totalCouponsPaid: string;        // Total des coupons payés
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const BondSchema = new Schema<IBond>({
  bondId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  issuerAddress: { 
    type: String, 
    required: true,
    index: true 
  },
  issuerName: { 
    type: String, 
    required: true 
  },
  contactEmail: {
    type: String,
    required: true
  },
  tokenCurrency: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  tokenName: { 
    type: String, 
    required: true 
  },
  totalSupply: { 
    type: Schema.Types.Mixed,  // Accepte Number ou String
    required: true 
  },
  denomination: { 
    type: String
  },
  minimumTicket: { 
    type: Number,
    min: 0
  },
  couponRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 1  // 0.07 = 7%
  },
  couponFrequency: { 
    type: String, 
    required: true 
  },
  maturityDate: { 
    type: String,  // ISO string ou timestamp
    required: true 
  },
  issueDate: { 
    type: String,  // ISO string ou timestamp
    required: true 
  },
  durationYears: {
    type: Number,
    required: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'matured', 'defaulted', 'cancelled'],
    default: 'pending',
    index: true 
  },
  description: { 
    type: String
  },
  riskRating: { 
    type: String 
  },
  stats: {
    totalInvestors: { type: Number, default: 0 },
    totalInvested: { type: String, default: '0' },
    percentageDistributed: { type: Number, default: 0 },
    lastTransactionDate: { type: Number },
    totalCouponsPaid: { type: String, default: '0' }
  }
}, {
  timestamps: true
});

// Index composés pour requêtes fréquentes
BondSchema.index({ issuerAddress: 1, status: 1 });
BondSchema.index({ status: 1, maturityDate: 1 });

// Supprimer le modèle existant s'il existe (pour éviter les conflits de schéma)
if (mongoose.models.Bond) {
  delete mongoose.models.Bond;
}

export const Bond = mongoose.model<IBond>('Bond', BondSchema);
