import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { LoginForm } from '../src/components/login-form';
import { env } from '../src/lib/env';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

// Mock loginAction
jest.mock('../src/app/(auth)/login/actions', () => ({
  loginAction: jest.fn(),
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  LogIn: ({ className }: { className?: string }) => <div data-testid="login-icon" className={className} />,
}));

// Mock env
jest.mock('../src/lib/env', () => ({
  env: {
    DEPLOYMENT_MODE: 'self-hosted',
  },
}));

describe('LoginForm Rendering Logic', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
      root = null;
    }
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
    jest.clearAllMocks();
  });

  it('renders email/password form in self-hosted mode', async () => {
    // env.DEPLOYMENT_MODE is already 'self-hosted' via mock
    await act(async () => {
      root = createRoot(container!);
      root.render(<LoginForm />);
    });

    const emailLabel = container?.querySelector('label[for="email"]');
    expect(emailLabel).not.toBeNull();
    expect(emailLabel?.textContent).toBe('Email');

    const submitButton = container?.querySelector('button[type="submit"]');
    expect(submitButton).not.toBeNull();
    expect(submitButton?.textContent).toBe('Login');
  });

  it('renders Casdoor button in managed mode', async () => {
    // Change mock for this test
    const { env } = require('../src/lib/env');
    env.DEPLOYMENT_MODE = 'managed';

    await act(async () => {
      root = createRoot(container!);
      root.render(<LoginForm />);
    });

    const casdoorButton = container?.querySelector('button');
    expect(casdoorButton).not.toBeNull();
    expect(casdoorButton?.textContent).toContain('Login with Casdoor');

    const emailInput = container?.querySelector('input[name="email"]');
    expect(emailInput).toBeNull();
  });
});
