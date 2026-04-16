import { env } from '../src/lib/env';

describe('Deployment Mode Logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should default to self-hosted mode', () => {
    delete process.env.DEPLOYMENT_MODE;
    const { env } = require('../src/lib/env');
    expect(env.DEPLOYMENT_MODE).toBe('self-hosted');
  });

  it('should respect managed mode when set in process.env', () => {
    process.env.DEPLOYMENT_MODE = 'managed';
    // We need some other required envs to avoid zod error
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.AUTH_SECRET = 'secret';
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    
    const { env } = require('../src/lib/env');
    expect(env.DEPLOYMENT_MODE).toBe('managed');
  });
});
