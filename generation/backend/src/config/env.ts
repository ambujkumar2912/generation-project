import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV must be development, test, or production');
}

const port = Number.parseInt(process.env.PORT ?? '4000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port number');
}

const jwtSecret = required('JWT_SECRET');
const insecureJwtSecret = /replace_with|changeme|default|example|your[-_ ]?secret/i.test(jwtSecret);
if (jwtSecret.length < 32 || insecureJwtSecret) {
  throw new Error('JWT_SECRET must be a unique, non-placeholder secret of at least 32 characters');
}

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
try {
  new URL(frontendOrigin);
} catch {
  throw new Error('FRONTEND_ORIGIN must be a valid URL');
}

const storageProvider = process.env.STORAGE_PROVIDER ?? 'local';
if (nodeEnv === 'production' && storageProvider === 'local') {
  throw new Error('STORAGE_PROVIDER=local is not permitted in production');
}

export const env = {
  port,
  nodeEnv,
  databaseUrl: required('DATABASE_URL'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  frontendOrigin,
  storage: {
    provider: storageProvider,
    bucket: process.env.STORAGE_BUCKET ?? '',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
    region: process.env.STORAGE_REGION ?? '',
    endpoint: process.env.STORAGE_ENDPOINT ?? '',
  },
};
