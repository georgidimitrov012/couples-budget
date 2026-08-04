// Native glue for CSV export: write the file to the cache dir, then hand it to
// the OS share sheet. Isolated here (away from lib/csv.ts) so screens can import
// it while tests mock this module instead of the native expo-* deps.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type ShareCsvResult = { ok: boolean; error?: string };

/**
 * Writes `content` to `<cache>/<filename>` and opens the share sheet. Never
 * throws — returns `{ ok: false, error }` so the caller can surface a message.
 */
export async function shareCsv(
  filename: string,
  content: string,
  dialogTitle: string
): Promise<ShareCsvResult> {
  try {
    const dir = FileSystem.cacheDirectory;
    if (!dir) return { ok: false, error: 'no-cache-dir' };
    const uri = dir + filename;
    await FileSystem.writeAsStringAsync(uri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) return { ok: false, error: 'sharing-unavailable' };
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle,
      UTI: 'public.comma-separated-values-text',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
