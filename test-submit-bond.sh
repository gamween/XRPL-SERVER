#!/bin/bash

# Script de test pour la route POST /v1/bonds/submit
# Teste l'endpoint avec le payload d'exemple

API_URL="http://localhost:4000/v1/bonds/submit"
API_KEY="supersecret"

echo "🧪 Test de la route POST /v1/bonds/submit"
echo "=========================================="
echo ""

# Payload d'exemple
PAYLOAD='{
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

echo "📤 Envoi de la requête..."
echo ""

# Exécuter la requête curl
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "$PAYLOAD")

# Extraire le code HTTP et le body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "📥 Réponse HTTP: $HTTP_CODE"
echo ""
echo "📦 Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Vérifier le résultat
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Test réussi!"
else
  echo "❌ Test échoué (code $HTTP_CODE)"
fi
