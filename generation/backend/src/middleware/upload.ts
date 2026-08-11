import multer from 'multer';
import path from 'path';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function hasSignature(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function validateVerificationDocument(file: Express.Multer.File): string | null {
  if (!ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
    return 'Only JPEG, PNG, or PDF files are allowed';
  }

  const isJpeg = hasSignature(file.buffer, [0xff, 0xd8, 0xff]);
  const isPng = hasSignature(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isPdf = hasSignature(file.buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (!isJpeg && !isPng && !isPdf) {
    return 'The uploaded file does not appear to be a valid JPEG, PNG, or PDF';
  }

  return null;
}

export const uploadVerificationDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req: Request, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, or PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('document');
