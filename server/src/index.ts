import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import calculateRouter from './routes/calculate';
import capitalGainsRouter from './routes/capitalGainsUpload';
import tdsRouter from './routes/tdsUpload';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 5000;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

// Vercel automatically exposes VERCEL_URL (e.g. "taxsmart-india.vercel.app") on every deployment.
// We also accept any CLIENT_ORIGIN override and the local dev servers.
const allowedOrigins: string[] = [
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim()) : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin requests (no Origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting: 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parser — limit size to prevent DoS via large payloads
app.use(express.json({ limit: '100kb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/calculate', calculateRouter);
app.use('/api/capital-gains', capitalGainsRouter);
app.use('/api/tds', tdsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start HTTP server when run directly (not when imported by Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Tax Calculator API running on http://localhost:${PORT}`);
  });
}

export default app;

