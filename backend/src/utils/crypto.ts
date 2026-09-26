import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(env.ENCRYPTION_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(env.ENCRYPTION_KEY),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

export function hashKey(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
