jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

import * as SecureStore from 'expo-secure-store';
import { ChunkedSecureStore } from '../../lib/chunked-secure-store';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

describe('ChunkedSecureStore', () => {
  it('round-trips a small value in a single chunk', async () => {
    await ChunkedSecureStore.setItem('k', 'hello');
    expect(store.get('k__n')).toBe('1');
    expect(await ChunkedSecureStore.getItem('k')).toBe('hello');
  });

  it('splits and reassembles a value larger than the 2KB chunk size', async () => {
    const big = 'x'.repeat(5000); // 2000 + 2000 + 1000 => 3 chunks
    await ChunkedSecureStore.setItem('sess', big);
    expect(store.get('sess__n')).toBe('3');
    expect(await ChunkedSecureStore.getItem('sess')).toBe(big);
  });

  it('removeItem clears every chunk and the count key', async () => {
    await ChunkedSecureStore.setItem('sess', 'y'.repeat(4500));
    await ChunkedSecureStore.removeItem('sess');
    expect([...store.keys()].filter((k) => k.startsWith('sess'))).toHaveLength(0);
    expect(await ChunkedSecureStore.getItem('sess')).toBeNull();
  });

  it('reads a legacy plain value stored without a chunk count', async () => {
    store.set('legacy', 'plain-token');
    expect(await ChunkedSecureStore.getItem('legacy')).toBe('plain-token');
  });

  it('overwriting a large value with a smaller one leaves no stale chunks', async () => {
    await ChunkedSecureStore.setItem('k', 'z'.repeat(5000)); // 3 chunks
    await ChunkedSecureStore.setItem('k', 'small'); // 1 chunk
    expect(await ChunkedSecureStore.getItem('k')).toBe('small');
    expect(store.get('k__n')).toBe('1');
    expect(store.has('k__2')).toBe(false);
  });
});
