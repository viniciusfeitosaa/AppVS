import bcrypt from 'bcryptjs';
import env from '../config/env';

const SALT_ROUNDS = parseInt(env.BCRYPT_ROUNDS) || 12;

/**
 * Gera hash da senha
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compara senha com hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
