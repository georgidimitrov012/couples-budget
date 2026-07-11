import { renderHook, waitFor, act } from '@testing-library/react-native';

const mockInvoke = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => mockUpload(...a),
        remove: (...a: unknown[]) => mockRemove(...a),
      }),
    },
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));
jest.mock('../../hooks/useHousehold', () => {
  const household = { id: 'h1' };
  return { useHousehold: () => ({ household }) };
});

import { useReceiptScan } from '../../hooks/useReceiptScan';
import type { LinePayload } from '../../lib/receipt';

const SCAN = {
  merchant: 'Kaufland',
  purchased_on: '2026-07-11',
  currency: 'BGN',
  items: [{ name: 'Milk', quantity: 1, price: 2.5 }],
};

// A valid base64 payload ("hello") so atob() in the hook succeeds.
const IMG = { base64: 'aGVsbG8=', mimeType: 'image/jpeg' };
const LINES: LinePayload[] = [
  { name: 'Milk', amount: 2.5, scope: 'shared', action: 'check', list_item_id: 'li1' },
];

beforeEach(() => {
  mockInvoke.mockResolvedValue({ data: SCAN, error: null });
  mockUpload.mockResolvedValue({ error: null });
  mockRemove.mockResolvedValue({ error: null });
  mockRpc.mockResolvedValue({ error: null });
});

describe('useReceiptScan', () => {
  it('scan() returns the structured result from the Edge Function', async () => {
    const { result } = await renderHook(() => useReceiptScan());
    let scanned;
    await act(async () => {
      scanned = await result.current.scan(IMG);
    });
    expect(mockInvoke).toHaveBeenCalledWith('scan-receipt', {
      body: { image: 'aGVsbG8=', mediaType: 'image/jpeg' },
    });
    expect(scanned).toEqual(SCAN);
  });

  it('scan() surfaces an error and returns null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = await renderHook(() => useReceiptScan());
    let scanned;
    await act(async () => {
      scanned = await result.current.scan(IMG);
    });
    expect(scanned).toBeNull();
    await waitFor(() => expect(result.current.error).toMatch(/could not read/i));
  });

  it('apply() uploads the image then calls apply_receipt with the payload', async () => {
    const { result } = await renderHook(() => useReceiptScan());
    let ok;
    await act(async () => {
      ok = await result.current.apply({
        image: IMG,
        merchant: 'Kaufland',
        purchasedOn: '2026-07-11',
        currency: 'BGN',
        lines: LINES,
      });
    });
    expect(ok).toBe(true);
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^h1\/\d+\.jpg$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/jpeg' })
    );
    expect(mockRpc).toHaveBeenCalledWith('apply_receipt', {
      p_household_id: 'h1',
      p_image_path: expect.stringMatching(/^h1\/\d+\.jpg$/),
      p_merchant: 'Kaufland',
      p_purchased_on: '2026-07-11',
      p_currency: 'BGN',
      p_lines: LINES,
    });
  });

  it('apply() aborts (no RPC) when the image upload fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'storage down' } });
    const { result } = await renderHook(() => useReceiptScan());
    let ok;
    await act(async () => {
      ok = await result.current.apply({
        image: IMG,
        merchant: null,
        purchasedOn: null,
        currency: null,
        lines: LINES,
      });
    });
    expect(ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.error).toMatch(/couldn't save/i));
  });

  it('apply() cleans up the uploaded image when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'rpc denied' } });
    const { result } = await renderHook(() => useReceiptScan());
    let ok;
    await act(async () => {
      ok = await result.current.apply({
        image: IMG,
        merchant: null,
        purchasedOn: null,
        currency: null,
        lines: LINES,
      });
    });
    expect(ok).toBe(false);
    expect(mockRemove).toHaveBeenCalledWith([expect.stringMatching(/^h1\/\d+\.jpg$/)]);
    await waitFor(() => expect(result.current.error).toBe('rpc denied'));
  });
});
