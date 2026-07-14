import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GoogleAuthCoordinator } from '../googleAuthCoordinator';
import { getEnhancedAuthService } from '../EnhancedAuthService';

jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn(), hide: jest.fn(), dispose: jest.fn() })),
  },
  commands: {
    executeCommand: jest.fn(),
  },
  env: {
    openExternal: jest.fn(),
  },
  Uri: {
    parse: jest.fn(),
  },
}));

jest.mock('../EnhancedAuthService', () => ({
  getEnhancedAuthService: jest.fn(),
}));

const mockedGetEnhancedAuthService = getEnhancedAuthService as jest.MockedFunction<typeof getEnhancedAuthService>;

describe('GoogleAuthCoordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows signing in without a stored client secret', async () => {
    const signInWithGoogle = jest.fn(async (_context: any, _clientId: string, _clientSecret?: string) => undefined) as any;
    mockedGetEnhancedAuthService.mockReturnValue({
      getToken: jest.fn(async () => undefined),
      storeToken: jest.fn(async () => undefined),
      signInWithGoogle,
      signOut: jest.fn(async () => undefined),
    } as any);

    const coordinator = new GoogleAuthCoordinator();
    const context = {
      secrets: {
        get: jest.fn(async () => null),
        store: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
      },
    } as any;

    (coordinator as any).context = context;

    await coordinator.signInWithGoogle();

    expect(signInWithGoogle).toHaveBeenCalledWith(
      context,
      '870407549580-blv0bht7ston2q2ksc1380vsd71l71sv.apps.googleusercontent.com',
      ''
    );
  });
});
