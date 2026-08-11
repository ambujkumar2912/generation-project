import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

// This is an adapter interface: local disk is used for development only.
// To go to production, implement the same `save`/`delete` shape against
// a real object storage provider (S3, R2, etc.) and swap it in based on
// env.storage.provider. Nothing else in the app needs to change.

export interface StorageAdapter {
  save(fileBuffer: Buffer, originalName: string): Promise<string>; // returns storage key
  delete(storageKey: string): Promise<void>;
}

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'verification');

class LocalDiskStorageAdapter implements StorageAdapter {
  constructor() {
    if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
      fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
    }
  }

  async save(fileBuffer: Buffer, originalName: string): Promise<string> {
    const ext = path.extname(originalName) || '';
    const key = `${uuidv4()}${ext}`;
    fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, key), fileBuffer);
    return key;
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(LOCAL_UPLOAD_DIR, storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function buildStorageAdapter(): StorageAdapter {
  if (env.storage.provider === 'local') {
    return new LocalDiskStorageAdapter();
  }
  // Placeholder: real providers get implemented here when credentials
  // are available (e.g. an S3StorageAdapter using @aws-sdk/client-s3).
  throw new Error(
    `Storage provider "${env.storage.provider}" is not yet implemented. ` +
    `Set STORAGE_PROVIDER=local for development.`
  );
}

export const storageAdapter = buildStorageAdapter();
