# 🚀 XRPL-SERVER - Backend pour XRPL Bonds

Backend Node.js/TypeScript pour la gestion des obligations tokenisées sur XRPL avec MongoDB Atlas.

## 📋 Table des matières

- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [API Routes](#api-routes)
- [Nouvelle Route : Submit Bond](#nouvelle-route--submit-bond)
- [Tests](#tests)
- [Documentation](#documentation)

## 🔧 Installation

```bash
npm install
```

## ⚙️ Configuration

### 1. Fichier .env

Copiez `.env.example` vers `.env` et configurez les variables :

```env
# MongoDB Atlas (REQUIS)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/xrpl-bonds?retryWrites=true&w=majority

# Serveur
PORT=4000
NODE_ENV=development

# API Key pour route /v1/bonds/submit (REQUIS)
API_KEY=supersecret

# XRPL Network
XRPL_URL=wss://s.altnet.rippletest.net:51233

# Wallet émetteur (optionnel)
ISSUER_SEED=
```

### 2. MongoDB Atlas

Assurez-vous d'avoir :
- Un cluster MongoDB Atlas actif
- Une base de données nommée `xrpl-bonds`
- Les permissions d'écriture

## 🏃 Démarrage

### Mode développement

```bash
npm run dev
```

### Mode production

```bash
npm run build
npm start
```

Le serveur démarre sur `http://localhost:4000`

## 🛣️ API Routes

### Routes existantes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Santé du serveur |
| GET | `/api/bonds` | Liste toutes les obligations |
| GET | `/api/bonds/:bondId` | Détails d'une obligation |
| POST | `/api/bonds` | Créer une obligation |
| GET | `/api/bonds/:bondId/investors` | Liste des investisseurs |
| GET | `/api/bonds/:bondId/stats` | Statistiques d'une obligation |

### ⭐ Nouvelle Route : Submit Bond

**POST `/v1/bonds/submit`** - Soumission d'une nouvelle obligation depuis le front

#### Authentification

Requiert le header : `x-api-key: supersecret`

#### Payload

```json
{
  "issuerName": "ACME Corp",
  "contactEmail": "bond@acme.com",
  "couponFrequency": "Quarterly",
  "totalSupply": 1000000,
  "issuerAddress": "rXXXXXXXXXXXXXXXXXXXXXXXX",
  "issueDate": "2025-11-08T09:50:00Z",
  "maturityDate": "2028-11-08T00:00:00Z",
  "durationYears": 3,
  "couponRate": 0.07,
  "bondId": "BOND-1762591845170-6952",
  "tokenName": "ACME2028",
  "tokenCurrency": "ACM28",
  "minimumTicket": 100
}
```

#### Réponse

```json
{
  "ok": true,
  "bond": {
    "bondId": "BOND-1762591845170-6952",
    "issuerName": "ACME Corp",
    "tokenName": "ACME2028",
    "status": "pending"
  },
  "holdersCollection": "holders_BOND-1762591845170-6952"
}
```

#### Comportement

1. **Upsert** dans la collection `bonds` avec mapping exact des champs
2. **Création automatique** de la collection `holders_<bondId>` avec :
   - Index unique sur `account`
   - Index simple sur `createdAt`
3. Status par défaut : `"pending"`

## 🧪 Tests

### Test de santé

```bash
curl http://localhost:4000/health
```

### Test de la route submit

**Option 1 : Script automatisé**

```bash
./test-submit-bond.sh
```

**Option 2 : curl manuel**

```bash
curl -X POST http://localhost:4000/v1/bonds/submit \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecret" \
  -d @test-payload.json
```

**Option 3 : curl avec payload inline**

```bash
curl -X POST http://localhost:4000/v1/bonds/submit \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecret" \
  -d '{
    "issuerName": "Test Company",
    "contactEmail": "test@example.com",
    "couponFrequency": "Quarterly",
    "totalSupply": 500000,
    "issuerAddress": "rTestAddress123",
    "issueDate": "2025-11-08T00:00:00Z",
    "maturityDate": "2027-11-08T00:00:00Z",
    "durationYears": 2,
    "couponRate": 0.05,
    "bondId": "BOND-TEST-001",
    "tokenName": "TEST2027",
    "tokenCurrency": "TST27",
    "minimumTicket": 50
  }'
```

## 📚 Documentation

- **[SUMMARY.md](SUMMARY.md)** - Résumé complet de l'implémentation
- **[API_SUBMIT.md](API_SUBMIT.md)** - Documentation détaillée de la route `/v1/bonds/submit`
- **[SETUP.md](SETUP.md)** - Guide de configuration et démarrage
- **[DEPLOY.md](DEPLOY.md)** - Guide de déploiement

## 🗂️ Structure du projet

```
XRPL-SERVER/
├── src/
│   ├── server.ts              # Point d'entrée
│   ├── config/
│   │   └── database.ts        # Configuration MongoDB
│   ├── middleware/
│   │   ├── apiAuth.ts         # 🆕 Auth par API key
│   │   ├── errorHandler.ts
│   │   └── validation.ts
│   ├── models/
│   │   ├── Bond.ts            # 🔄 Modèle mis à jour
│   │   ├── BondInvestor.ts
│   │   └── index.ts
│   ├── routes/
│   │   └── bonds.ts           # 🔄 Route /submit ajoutée
│   ├── services/
│   │   ├── BondEventNotifier.ts
│   │   ├── BondStatsService.ts
│   │   ├── BondTransactionMonitor.ts
│   │   └── CouponDistributionService.ts
│   └── scripts/               # Scripts utilitaires
├── test-submit-bond.sh        # 🆕 Script de test
├── test-payload.json          # 🆕 Payload d'exemple
└── package.json
```

## 🔐 Sécurité

- ✅ Authentification par clé API sur route `/v1/bonds/submit`
- ✅ CORS configuré
- ✅ Validation des champs requis
- ✅ Variables sensibles dans `.env`
- ✅ Pas de credentials dans le code

## 🎯 Mapping Front → Backend

| Front (form field)      | Backend (MongoDB)   |
|-------------------------|---------------------|
| Company Name            | issuerName          |
| Contact Email           | contactEmail        |
| Coupon Frequency        | couponFrequency     |
| Liquidity Needed        | totalSupply         |
| Issuer XRPL Address     | issuerAddress       |
| Start Time              | issueDate           |
| End Time                | maturityDate        |
| Duration                | durationYears       |
| Coupon Rate             | couponRate          |
| Bond Code               | bondId              |
| Token Name              | tokenName           |
| Token ID                | tokenCurrency       |
| Minimum Ticket          | minimumTicket       |

## 🤝 Intégration Front-End (XRPL-BONDS)

Dans votre repo Next.js, après soumission du formulaire :

```typescript
const response = await fetch('http://localhost:4000/v1/bonds/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.NEXT_PUBLIC_API_KEY
  },
  body: JSON.stringify({
    issuerName: formData.companyName,
    contactEmail: formData.contactEmail,
    couponFrequency: formData.couponFrequency,
    totalSupply: formData.liquidityNeeded,
    issuerAddress: formData.issuerAddress,
    issueDate: formData.startTime,
    maturityDate: formData.endTime,
    durationYears: formData.duration,
    couponRate: formData.couponRate,
    bondId: formData.bondCode,
    tokenName: formData.tokenName,
    tokenCurrency: formData.tokenId,
    minimumTicket: formData.minimumTicket
  })
});

const result = await response.json();
if (result.ok) {
  console.log('✅ Bond créé:', result.bond);
}
```

## 📦 Scripts disponibles

```bash
npm run dev              # Démarre en mode développement
npm run build            # Compile TypeScript
npm start                # Démarre en mode production
npm run migrate          # Migration de données
npm run create-bond      # Créer une obligation test
npm run sync-holders     # Synchroniser les holders
npm run execute-coupons  # Exécuter les paiements de coupons
```

## 🐛 Dépannage

### Le serveur ne démarre pas

```bash
# Vérifier que MongoDB URI est configuré
cat .env | grep MONGODB_URI

# Vérifier que le port est libre
lsof -i :4000

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur 401/403 sur /v1/bonds/submit

- Vérifier que le header `x-api-key` est présent
- Vérifier que la valeur correspond à `API_KEY` dans `.env`

### Collection holders_ non créée

- Vérifier les logs du serveur
- Vérifier les permissions MongoDB (écriture requise)
- Vérifier que `bondId` est bien fourni dans le payload

## 📝 License

MIT

## 👥 Auteurs

Développé pour le projet XRPL Bonds

---

**Note** : Ce serveur nécessite MongoDB Atlas pour fonctionner. Assurez-vous de configurer `MONGODB_URI` dans `.env` avant de démarrer.
