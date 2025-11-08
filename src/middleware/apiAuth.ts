import { Request, Response, NextFunction } from 'express';

/**
 * Middleware pour vérifier la clé API
 * Vérifie le header x-api-key contre process.env.API_KEY
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_KEY;

  // Si pas de clé API configurée, passer (mode dev)
  if (!expectedApiKey) {
    console.warn('⚠️  API_KEY non configurée dans .env, authentification désactivée');
    return next();
  }

  // Vérifier la présence du header
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing x-api-key header'
    });
  }

  // Vérifier la validité de la clé
  if (apiKey !== expectedApiKey) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  // Clé valide, continuer
  next();
}
