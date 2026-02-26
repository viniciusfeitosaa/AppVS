import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import env from './config/env';
import { connectDatabase } from './config/database';

// Importar rotas
import authRoutes from './routes/auth.routes';
import medicoRoutes from './routes/medico.routes';
import adminRoutes from './routes/admin.routes';
import pontoRoutes from './routes/ponto.routes';

// Criar aplicação Express
const app: Express = express();

// Middleware de segurança
app.use(helmet());

// CORS
const allowedOrigins = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(',')
  : env.FRONTEND_URL
  ? [env.FRONTEND_URL]
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting global (evita 429 ao carregar dashboard com várias queries em paralelo)
const rateWindowMs = parseInt(env.RATE_LIMIT_WINDOW_MS, 10) || 900000;
const rateMax = Math.max(100, parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10) || 500);
const limiter = rateLimit({
  windowMs: rateWindowMs,
  max: rateMax,
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Garantir que respostas JSON sejam enviadas em UTF-8 (evita mojibake na exibição)
app.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = function (this: Response, body: unknown) {
    this.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson(body);
  };
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/medico', medicoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ponto', pontoRoutes);

// Rota raiz
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'API App Médico',
    version: '1.0.0',
    status: 'running',
  });
});

// Middleware de erro 404
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
  });
});

// Middleware de tratamento de erros
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Erro:', err);

  res.status(500).json({
    error: 'Erro interno do servidor',
    message: env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Função para inicializar a aplicação
export async function createApp(): Promise<Express> {
  // Conectar ao banco de dados
  await connectDatabase();

  return app;
}

export default app;
