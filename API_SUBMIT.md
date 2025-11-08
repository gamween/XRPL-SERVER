# API Documentation - Route de soumission des obligations

## POST /v1/bonds/submit

Cette route est appelée par le front-end (XRPL-BONDS) lorsque l'écran "Submission Received!" apparaît après la soumission d'une application d'obligation.

### Authentification

Requiert un header `x-api-key` avec la clé configurée dans `.env` :

```
x-api-key: supersecret
```

### Endpoint

```
POST http://localhost:4000/v1/bonds/submit
```

### Headers

```
Content-Type: application/json
x-api-key: supersecret
```

### Body (JSON)

Tous les champs listés ci-dessous sont mappés depuis le formulaire front :

```json
{
  "issuerName": "ACME Corp",              // Mapping: Company Name → issuerName
  "contactEmail": "bond@acme.com",        // Mapping: Contact Email → contactEmail
  "couponFrequency": "Quarterly",         // Mapping: Coupon Frequency → couponFrequency
  "totalSupply": 1000000,                 // Mapping: Liquidity Needed → totalSupply
  "issuerAddress": "rXXXXXXXXXXXXXXX",   // Mapping: Issuer XRPL Address → issuerAddress
  "issueDate": "2025-11-08T09:50:00Z",   // Mapping: Start Time → issueDate
  "maturityDate": "2028-11-08T00:00:00Z", // Mapping: End Time → maturityDate
  "durationYears": 3,                     // Mapping: Duration → durationYears
  "couponRate": 0.07,                     // Mapping: Coupon Rate → couponRate (0.07 = 7%)
  "bondId": "BOND-1762591845170-6952",   // Mapping: Bond Code → bondId
  "tokenName": "ACME2028",                // Mapping: Token Name → tokenName
  "tokenCurrency": "ACM28",               // Mapping: Token ID → tokenCurrency
  "minimumTicket": 100                    // Mapping: Minimum Ticket → minimumTicket
}
```

### Champs requis

- `bondId` : Identifiant unique de l'obligation (requis)

Tous les autres champs sont fortement recommandés pour un fonctionnement complet.

### Réponse Success (200 OK)

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

### Réponse Error (400 Bad Request)

```json
{
  "ok": false,
  "error": "Missing required field: bondId"
}
```

### Réponse Error (401 Unauthorized)

```json
{
  "ok": false,
  "error": "Missing x-api-key header"
}
```

### Réponse Error (403 Forbidden)

```json
{
  "ok": false,
  "error": "Invalid API key"
}
```

### Réponse Error (500 Internal Server Error)

```json
{
  "ok": false,
  "error": "Failed to submit bond"
}
```

## Comportement

1. **Upsert dans MongoDB** : L'obligation est insérée dans `xrpl-bonds.bonds` avec le mapping exact des champs. Si `bondId` existe déjà, l'enregistrement est mis à jour.

2. **Collection des porteurs** : Une collection dédiée `holders_<bondId>` est créée automatiquement avec :
   - Index unique : `{ account: 1 }` nommé `uniq_account`
   - Index simple : `{ createdAt: 1 }` nommé `idx_createdAt`

3. **Status par défaut** : Toutes les nouvelles obligations ont le status `"pending"` par défaut.

## Intégration front-end

Dans le repo **XRPL-BONDS**, ajouter l'appel API après la soumission réussie :

```typescript
// Exemple d'intégration (à adapter selon votre code front)
async function submitBondApplication(formData: BondFormData) {
  try {
    // ... votre logique de soumission actuelle ...
    
    // Après succès, envoyer au serveur
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
      console.log('✅ Collection porteurs:', result.holdersCollection);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la soumission:', error);
  }
}
```

## Test manuel

Utilisez le script fourni :

```bash
./test-submit-bond.sh
```

Ou avec curl directement :

```bash
curl -X POST http://localhost:4000/v1/bonds/submit \
  -H "Content-Type: application/json" \
  -H "x-api-key: supersecret" \
  -d '{
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
  }'
```

## Vérification dans MongoDB

Après un appel réussi, vérifiez dans MongoDB :

1. **Collection `bonds`** :
   ```javascript
   db.bonds.findOne({ bondId: "BOND-1762591845170-6952" })
   ```

2. **Collection des porteurs** :
   ```javascript
   db.getCollection("holders_BOND-1762591845170-6952").getIndexes()
   ```

## Notes importantes

- ⚠️ Ne pas oublier de configurer `API_KEY` dans `.env`
- ⚠️ Le front doit envoyer la requête APRÈS que l'application soit validée
- ⚠️ `bondId` doit être unique pour chaque obligation
- ⚠️ Configurer `MONGODB_URI` correctement dans `.env`
