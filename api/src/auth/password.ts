import { randomInt } from 'node:crypto';

import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Hash fixo usado quando o login não existe: compara mesmo assim, para que
// "usuário não existe" e "senha errada" levem o mesmo tempo.
const DUMMY_HASH = bcrypt.hashSync('scanmercado-dummy-password', BCRYPT_ROUNDS);

export async function verifyPasswordOrDummy(password: string, hash: string | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}

/** Senha temporária legível (sem 0/O, 1/l/I), gerada com aleatoriedade criptográfica. */
export function temporaryPassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) result += alphabet[randomInt(alphabet.length)];
  return result;
}
