import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import env from './config/env';

// Importar rotas
import authRoutes from './routes/auth.routes';
import medicoRoutes from './routes/medico.routes';
import adminRoutes from './routes/admin.routes';
import pontoRoutes from './routes/ponto.routes';

// Criar aplicação Express
const app: Express = express();

// Necessário atrás do proxy do Render (evita erro do express-rate-limit com X-Forwarded-For)
app.set('trust proxy', 1);

// Middleware de segurança
app.use(helmet());

// CORS – origem de produção sempre permitida; demais vêm do env (trim para evitar espaços)
const originsFromEnv = [
  ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) : []),
  ...(env.FRONTEND_URL ? [env.FRONTEND_URL.trim()] : []),
];
const allowedOriginsSet = new Set([
  'https://sejavivasaude.com.br',
  'http://localhost:3000',
  'http://localhost:5173',
  ...originsFromEnv,
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOriginsSet.has(origin)) return cb(null, true);
      cb(null, false);
    },
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
// Arquivos em uploads/ não são mais servidos publicamente (ver rotas autenticadas em medico/ponto/admin).

// Observabilidade básica (tempo por request) — habilite com REQUEST_LOG_MS=200 (exemplo).
const REQUEST_LOG_MS = parseInt(process.env.REQUEST_LOG_MS || '', 10);
if (Number.isFinite(REQUEST_LOG_MS) && REQUEST_LOG_MS > 0) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      if (ms >= REQUEST_LOG_MS) {
        console.log(`[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
      }
    });
    next();
  });
}

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

// Função para inicializar a aplicação (não espera o banco – conexão em background no server.ts)
export function createApp(): Express {
  return app;
}

export default app;
