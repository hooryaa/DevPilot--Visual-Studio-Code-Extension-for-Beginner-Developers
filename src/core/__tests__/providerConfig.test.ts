import { normalizeAIProvider, buildMissingApiKeyMessage, getProviderDisplayName } from '../providerConfig';

describe('providerConfig helpers', () => {
  it('normalizes provider names and defaults to local', () => {
    expect(normalizeAIProvider('OpenAI')).toBe('openai');
    expect(normalizeAIProvider('gemini')).toBe('gemini');
    expect(normalizeAIProvider('unknown')).toBe('local');
  });

  it('builds a friendly setup message for missing API keys', () => {
    const message = buildMissingApiKeyMessage('gemini');
    expect(message).toContain('Gemini');
    expect(message).toContain('DevPilot: Configure AI Provider');
  });

  it('returns a human-readable provider label', () => {
    expect(getProviderDisplayName('openai')).toBe('OpenAI');
    expect(getProviderDisplayName('gemini')).toBe('Gemini');
    expect(getProviderDisplayName('local')).toBe('Local (FreeGPT)');
  });
});
