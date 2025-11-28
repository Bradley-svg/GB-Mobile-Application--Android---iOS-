import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  organisation_id: string | null;
};

export async function registerUser(email: string, password: string, name: string) {
  const existing = await query<UserRow>('select * from users where email = $1', [email]);
  if (existing.rowCount > 0) {
    throw new Error('EMAIL_EXISTS');
  }

  const hash = await bcrypt.hash(password, 10);

  const result = await query<UserRow>(
    'insert into users (email, password_hash, name) values ($1, $2, $3) returning id, email, name, organisation_id',
    [email, hash, name]
  );

  return result.rows[0];
}

export async function loginUser(email: string, password: string) {
  const result = await query<UserRow>('select * from users where email = $1', [email]);
  const user = result.rows[0];
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return { id: user.id, email: user.email, name: user.name, organisation_id: user.organisation_id };
}

export function issueTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; type: string };
  if (decoded.type !== 'access') throw new Error('INVALID_TOKEN_TYPE');
  return { userId: decoded.sub };
}
