import { describe, it, expect } from 'vitest';
import { checkBearer } from '../src/auth';

describe('checkBearer', () => {
  it('accepts the matching bearer token', async () => {
    expect(await checkBearer('Bearer s3cret', 's3cret')).toBe(true);
  });

  it('rejects a wrong token, a missing header and a non-Bearer scheme', async () => {
    expect(await checkBearer('Bearer nope', 's3cret')).toBe(false);
    expect(await checkBearer(undefined, 's3cret')).toBe(false);
    expect(await checkBearer('s3cret', 's3cret')).toBe(false);
  });

  it('fails closed when the secret is unset or empty', async () => {
    expect(await checkBearer('Bearer undefined', undefined)).toBe(false);
    expect(await checkBearer('Bearer ', '')).toBe(false);
    expect(await checkBearer('Bearer', '')).toBe(false);
  });
});
