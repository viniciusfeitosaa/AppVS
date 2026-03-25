import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';

const uploadBaseDir = path.resolve(process.cwd(), 'uploads', 'medicos');
if (!fs.existsSync(uploadBaseDir)) {
  fs.mkdirSync(uploadBaseDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadBaseDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname || 'arquivo', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sanitizedBase || 'arquivo'}-${unique}${ext}`);
  },
});

export const uploadPerfilDocumentos = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB por arquivo
    files: 12,
  },
});

const uploadDocEnviadoDir = path.resolve(process.cwd(), 'uploads', 'documentos-enviados');
if (!fs.existsSync(uploadDocEnviadoDir)) {
  fs.mkdirSync(uploadDocEnviadoDir, { recursive: true });
}

const storageDocEnviado = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDocEnviadoDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const sanitizedBase = path
      .basename(file.originalname || 'documento', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${sanitizedBase || 'documento'}-${unique}${ext}`);
  },
});

export const uploadDocumentoEnviado = multer({
  storage: storageDocEnviado,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

const uploadPontoCheckinDir = path.resolve(process.cwd(), 'uploads', 'ponto-checkin');
if (!fs.existsSync(uploadPontoCheckinDir)) {
  fs.mkdirSync(uploadPontoCheckinDir, { recursive: true });
}

const storagePontoCheckin = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    const tenantId = (req as any).user?.tenantId || 'unknown';
    const dir = path.join(uploadPontoCheckinDir, tenantId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `checkin-${unique}${safeExt}`);
  },
});

const imageMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadPontoCheckin = multer({
  storage: storagePontoCheckin,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (imageMime.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'));
    }
  },
});

/** Multer single('foto') com resposta JSON em erro (tipo/tamanho). */
export const uploadPontoCheckinMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  uploadPontoCheckin.single('foto')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : 'Erro no upload da foto';
      res.status(400).json({ success: false, error: msg });
      return;
    }
    next();
  });
};
