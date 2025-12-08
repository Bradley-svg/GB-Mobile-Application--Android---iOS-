import { afterEach, describe, expect, it } from 'vitest';
import { signFileToken, verifyFileToken } from '../src/services/fileUrlSigner';

const SECRET = 'test-signing-secret';

describe('fileUrlSigner', () => {
  afterEach(() => {
    delete process.env.FILE_SIGNING_SECRET;
  });

  it('creates tokens that round-trip through verification', () => {
    process.env.FILE_SIGNING_SECRET = SECRET;
    const expiresAt = new Date(Date.now() + 60_000);

    const token = signFileToken('file-123', expiresAt);
    const verification = verifyFileToken(token);

    expect(verification).toEqual({
      valid: true,
      expired: false,
      fileId: 'file-123',
    });
  });

  it('marks expired tokens correctly', () => {
    process.env.FILE_SIGNING_SECRET = SECRET;
    const token = signFileToken('file-123', new Date(Date.now() - 1_000));

    const verification = verifyFileToken(token);

    expect(verification.valid).toBe(false);
    expect(verification.expired).toBe(true);
  });

  it('treats verification as disabled when no secret is set', () => {
    const verification = verifyFileToken('invalid');
    expect(verification.valid).toBe(false);
    expect(verification.expired).toBe(false);
  });
});
