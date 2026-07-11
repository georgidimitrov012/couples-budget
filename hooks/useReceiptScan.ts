import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useHousehold } from './useHousehold';
import type { LinePayload, ScanResult } from '../lib/receipt';

type ImageInput = { base64: string; mimeType?: string };

function extFor(mimeType?: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

// base64 → bytes for the Storage upload. atob is available in the RN (Hermes)
// and Node test runtimes; supabase-js accepts the Uint8Array directly.
function toBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Drives receipt scanning: `scan()` sends the photo to the scan-receipt Edge
 * Function (Claude vision) and returns structured line items; `apply()` uploads
 * the image to the private `receipts` bucket and calls the apply_receipt RPC,
 * which records the reviewed expenses and checks off matched list items. The
 * budget, settle-up, and list update themselves through their realtime channels.
 */
export function useReceiptScan() {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async (image: ImageInput): Promise<ScanResult | null> => {
    setScanning(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { image: image.base64, mediaType: image.mimeType ?? 'image/jpeg' },
      });
      if (error) {
        setError('Could not read the receipt. Please try again.');
        return null;
      }
      return data as ScanResult;
    } finally {
      setScanning(false);
    }
  }, []);

  const apply = useCallback(
    async (input: {
      image: ImageInput;
      merchant: string | null;
      purchasedOn: string | null;
      currency: string | null;
      lines: LinePayload[];
    }): Promise<boolean> => {
      if (!householdId) {
        setError('No household.');
        return false;
      }
      setApplying(true);
      setError(null);

      const path = `${householdId}/${Date.now()}.${extFor(input.image.mimeType)}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, toBytes(input.image.base64), {
          contentType: input.image.mimeType ?? 'image/jpeg',
          upsert: false,
        });
      if (uploadError) {
        setError(`Couldn't save the receipt image: ${uploadError.message}`);
        setApplying(false);
        return false;
      }

      const { error: rpcError } = await supabase.rpc('apply_receipt', {
        p_household_id: householdId,
        p_image_path: path,
        p_merchant: input.merchant,
        p_purchased_on: input.purchasedOn,
        p_currency: input.currency,
        p_lines: input.lines,
      });
      if (rpcError) {
        // Best-effort cleanup so a failed apply doesn't orphan the image.
        await supabase.storage.from('receipts').remove([path]).catch(() => {});
        setError(rpcError.message);
        setApplying(false);
        return false;
      }

      setApplying(false);
      return true;
    },
    [householdId]
  );

  return { scan, apply, scanning, applying, error };
}
