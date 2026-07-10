// Regression coverage for the env-var bug: the client must read EXPO_PUBLIC_*
// (not NEXT_PUBLIC_*) and accept either the publishable or the legacy anon key.
describe('supabase client configuration', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    jest.doMock('react-native-url-polyfill/auto', () => ({}));
    jest.doMock('../../lib/chunked-secure-store', () => ({ ChunkedSecureStore: {} }));
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({
        auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() },
      })),
    }));
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when the URL and key are both missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => require('../../lib/supabase')).toThrow(/Missing EXPO_PUBLIC_SUPABASE/);
  });

  it('uses the publishable key when present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub-key';
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const { createClient } = require('@supabase/supabase-js');
    require('../../lib/supabase');
    expect(createClient).toHaveBeenCalledWith(
      'https://proj.supabase.co',
      'pub-key',
      expect.anything()
    );
  });

  it('falls back to the legacy anon key', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const { createClient } = require('@supabase/supabase-js');
    require('../../lib/supabase');
    expect(createClient).toHaveBeenCalledWith(
      'https://proj.supabase.co',
      'anon-key',
      expect.anything()
    );
  });
});
