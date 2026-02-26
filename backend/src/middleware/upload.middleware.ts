import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { Request } from 'express';

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
