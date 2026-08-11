import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthTokenPayload {
  userId: string;
  isAdmin: boolean;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as any });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
