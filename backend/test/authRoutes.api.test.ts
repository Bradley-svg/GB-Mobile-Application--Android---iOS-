import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../src/config/db', () => ({
  query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]?])),
}));

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

let app: Express;
let token: string;

beforeAll(async () => {
  const mod = await import('../src/index');
  app = mod.default;
  token = jwt.sign({ sub: 'user-1', type: 'access' }, process.env.JWT_SECRET!);
});

beforeEach(() => {
  queryMock.mockReset();
});

describe('/auth/me/push-tokens', () => {
  it('rejects invalid body', async () => {
    await request(app)
      .post('/auth/me/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    expect(queryMock).not.toHaveBeenCalled();
  });

  it('skips storing when token was recently seen', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ last_used_at: new Date().toISOString() }],
      rowCount: 1,
    });

    const res = await request(app)
      .post('/auth/me/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'expotoken-123' })
      .expect(200);

    expect(res.body).toEqual({ ok: true, skipped: true });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain('from push_tokens');
  });

  it('upserts token when not recently used', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 'push-1' }], rowCount: 1 });

    const res = await request(app)
      .post('/auth/me/push-tokens')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'expotoken-456' })
      .expect(200);

    expect(res.body).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain('insert into push_tokens');
    expect(queryMock.mock.calls[1][1]).toEqual(['user-1', 'expotoken-456']);
  });
});

describe('/auth/reset-password', () => {
  it('is intentionally not exposed until a proper flow is designed', async () => {
    await request(app).post('/auth/reset-password').send({ email: 'person@example.com' }).expect(404);
  });
});

describe('/auth/refresh', () => {
  it('rotates refresh tokens and revokes the old one', async () => {
    let revoked = false;
    queryMock.mockImplementation(async (text: string, params?: any[]) => {
      if (text.includes('from refresh_tokens')) {
        return {
          rows: [
            {
              id: params?.[0],
              user_id: 'user-1',
              revoked,
              replaced_by: null,
              expires_at: new Date(Date.now() + 1000 * 60 * 60),
            },
          ],
          rowCount: 1,
        };
      }

      if (text.startsWith('\n    insert into refresh_tokens')) {
        return { rows: [], rowCount: 1 };
      }

      if (text.startsWith('\n    update refresh_tokens')) {
        revoked = true;
        return { rows: [], rowCount: 1 };
      }

      if (text.includes('from users')) {
        return {
          rows: [
            {
              id: params?.[0] ?? 'user-1',
              email: 'user-1@example.com',
              name: 'User One',
              organisation_id: 'org-1',
              role: 'admin',
              can_impersonate: false,
            },
          ],
          rowCount: 1,
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const refreshToken = jwt.sign(
      { sub: 'user-1', type: 'refresh', jti: 'rt-1' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    const first = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(first.body).toHaveProperty('accessToken');
    expect(first.body).toHaveProperty('refreshToken');
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('select id'), ['rt-1']);
    expect(revoked).toBe(true);

    // Old token now revoked
    await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
  });
});

describe('/auth/logout', () => {
  it('revokes the provided refresh token', async () => {
    let revoked = false;
    queryMock.mockImplementation(async (text: string, params?: any[]) => {
      if (text.includes('from refresh_tokens')) {
        return {
          rows: [
            {
              id: params?.[0],
              user_id: 'user-1',
              revoked,
              replaced_by: null,
              expires_at: new Date(Date.now() + 1000 * 60 * 60),
            },
          ],
          rowCount: 1,
        };
      }

      if (text.startsWith('\n    update refresh_tokens') && text.includes('where id = $1')) {
        revoked = true;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const refreshToken = jwt.sign(
      { sub: 'user-1', type: 'refresh', jti: 'rt-logout' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refreshToken })
      .expect(204);

    await request(app).post('/auth/refresh').send({ refreshToken }).expect(401);
  });
});

describe('/auth/logout-all', () => {
  it('revokes all refresh tokens for the current user', async () => {
    const tokenState: Record<string, boolean> = {
      'rt-a': false,
      'rt-b': false,
    };

    queryMock.mockImplementation(async (text: string, params?: any[]) => {
      if (text.includes('from refresh_tokens')) {
        const id = params?.[0];
        return {
          rows: [
            {
              id,
              user_id: 'user-1',
              revoked: tokenState[id as keyof typeof tokenState],
              replaced_by: null,
              expires_at: new Date(Date.now() + 1000 * 60 * 60),
            },
          ],
          rowCount: 1,
        };
      }

      if (text.startsWith('\n    update refresh_tokens') && text.includes('where user_id = $1')) {
        Object.keys(tokenState).forEach((key) => {
          tokenState[key] = true;
        });
        return { rows: [], rowCount: Object.keys(tokenState).length };
      }

      throw new Error(`Unexpected query: ${text}`);
    });

    const refreshTokenA = jwt.sign(
      { sub: 'user-1', type: 'refresh', jti: 'rt-a' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    const refreshTokenB = jwt.sign(
      { sub: 'user-1', type: 'refresh', jti: 'rt-b' },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    await request(app).post('/auth/logout-all').set('Authorization', `Bearer ${token}`).expect(204);

    await request(app).post('/auth/refresh').send({ refreshToken: refreshTokenA }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: refreshTokenB }).expect(401);
  });
});

describe('/auth/signup', () => {
  it('blocks public signup by default', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'new@example.com', password: 'hunter22', name: 'New User' })
      .expect(403);

    expect(res.body).toEqual({ error: 'Signup disabled. Contact administrator.' });
    expect(queryMock).not.toHaveBeenCalled();
  });
});
