
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

async function startServer() {
  const app = express();
  const PORT = 5000;

  // 1. Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP to allow Vite in dev
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DoS

  // 2. Global Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/', globalLimiter);

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/create-payment-intent', async (req, res) => {
    try {
      const { amount, currency = 'mad', metadata } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.status(200).json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error('Stripe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
