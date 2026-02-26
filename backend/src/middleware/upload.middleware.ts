import fs from 'fs';
import path from 'path';
import multer from 'multer';

const uploadBaseDir = path.resolve(process.cwd(), 'uploads', 'medicos');
if (!fs.existsSync(uploadBaseDir)) {
  fs.mkdirSync(uploadBaseDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadBaseDir);
  },
  filename: (_req, file, cb) => {
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
