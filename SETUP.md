# Configuration Rapide

## 1. Configuration MongoDB

⚠️ **IMPORTANT** : Avant de démarrer le serveur, configurez votre connexion MongoDB Atlas dans `.env` :

```bash
# Remplacer username, password et cluster par vos vraies credentials
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/xrpl-bonds?retryWrites=true&w=majority
```

## 2. Variables d'environnement requises

Éditez le fichier `.env` à la racine du projet :

```env
# MongoDB Atlas (REQUIS - remplacer par vos credentials réelles)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/xrpl-bonds?retryWrites=true&w=majority

# Port du serveur
PORT=4000

# Clé API pour protéger la route /v1/bonds/submit
API_KEY=supersecret

# XRPL Network
XRPL_URL=wss://s.altnet.rippletest.net:51233

# Optionnel
NODE_ENV=development
ISSUER_SEED=
```

## 3. Démarrage du serveur

```bash
# Mode développement (avec auto-reload)
npm run dev

# Mode production
npm run build
npm start
```

## 4. Test de la route

Une fois le serveur démarré sur le port 4000 :

```bash
# Utiliser le script de test fourni
./test-submit-bond.sh

# Ou avec curl directement
curl -X POST http://localhost:4000/v1/bonds/submit \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecret" \
  -d @- <<'EOF'
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
  "bondId": "BOND-TEST-001",
  "tokenName": "ACME2028",
  "tokenCurrency": "ACM28",
  "minimumTicket": 100
}
EOF
```

## 5. Vérification

### Vérifier que le serveur écoute :

```bash
curl http://localhost:4000/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "timestamp": "2025-11-08T..."
}
```

### Vérifier dans MongoDB :

Connectez-vous à MongoDB Atlas et vérifiez :

1. **Base de données** : `xrpl-bonds`
2. **Collection** : `bonds` - devrait contenir votre obligation
3. **Collection dynamique** : `holders_BOND-TEST-001` - créée automatiquement

## 6. Intégration avec le front

Dans votre repo **XRPL-BONDS** (Next.js), ajoutez l'appel API :

```typescript
// Après soumission réussie du formulaire
const response = await fetch('http://localhost:4000/v1/bonds/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'supersecret' // À mettre dans vos variables d'environnement
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
```

## 7. Dépannage

### Le serveur ne démarre pas

- Vérifiez que le port 4000 est libre : `lsof -i :4000`
- Vérifiez les logs de connexion MongoDB
- Vérifiez que toutes les dépendances sont installées : `npm install`

### Erreur 401/403 lors du test

- Vérifiez que le header `x-api-key` est bien envoyé
- Vérifiez que la valeur correspond à celle dans `.env`

### Collection holders_ non créée

- Vérifiez les logs du serveur pour voir les messages de création
- Vérifiez les permissions MongoDB (écriture requise)

## 8. Structure créée

Après l'implémentation, votre projet contient :

```
XRPL-SERVER/
├── .env                        # ✅ Créé - Variables d'environnement
├── API_SUBMIT.md              # ✅ Créé - Documentation API
├── SETUP.md                   # ✅ Créé - Ce fichier
├── test-submit-bond.sh        # ✅ Créé - Script de test
├── src/
│   ├── middleware/
│   │   └── apiAuth.ts         # ✅ Créé - Middleware d'authentification
│   ├── models/
│   │   └── Bond.ts            # ✅ Modifié - Mapping des champs
│   ├── routes/
│   │   └── bonds.ts           # ✅ Modifié - Route /submit ajoutée
│   └── server.ts              # ✅ Modifié - Route /v1/bonds montée
```

## 9. Prochaines étapes

Une fois la route testée et fonctionnelle :

1. Déployer le serveur en production (Railway, Heroku, etc.)
2. Mettre à jour l'URL de l'API dans le front
3. Configurer la vraie clé API (pas "supersecret")
4. Configurer CORS si le front est sur un domaine différent
5. Implémenter le monitoring et les logs en production
