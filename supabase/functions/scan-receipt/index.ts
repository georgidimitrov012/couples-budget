// Supabase Edge Function: scan-receipt
//
// Turns a photo of a paper receipt into structured line items using Claude
// vision. The ANTHROPIC_API_KEY lives here as a function secret — it is never
// shipped to the app (which uses the anon key only). The app calls this via
// supabase.functions.invoke('scan-receipt', { body: { image, mediaType } }).
//
// Deploy:  supabase functions deploy scan-receipt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//          (optional) supabase secrets set ANTHROPIC_MODEL=claude-haiku-4-5-20251001
//
// Deno runtime. See docs/SUPABASE_SETUP.md §6.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';

const SYSTEM = `You extract line items from a photo of a shopping receipt.
Return ONLY a JSON object, no prose, no code fences, matching exactly:
{
  "merchant": string | null,
  "purchased_on": string | null,   // ISO date YYYY-MM-DD if visible, else null
  "currency": string | null,       // ISO code like "BGN","EUR","USD" if inferable
  "items": [
    { "name": string, "quantity": number, "price": number }  // price = line total, not unit price
  ]
}
Rules:
- One entry per purchased product line. Merge a product with its immediately following weight/price line.
- Exclude subtotals, totals, tax/VAT lines, discounts, loyalty points, change, and payment lines.
- quantity defaults to 1 when not printed. price is a positive number in the receipt's currency, using a dot decimal.
- Keep the product name as printed (do not translate). If the receipt is unreadable, return items: [].`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Authenticate the caller — this endpoint spends money, so no anonymous use.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authHeader || !supabaseUrl || !anonKey) return json({ error: 'Unauthorized' }, 401);
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!userRes.ok) return json({ error: 'Unauthorized' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Receipt scanning is not configured.' }, 500);

  let image: string | undefined;
  let mediaType = 'image/jpeg';
  try {
    const body = await req.json();
    image = body.image;
    if (typeof body.mediaType === 'string') mediaType = body.mediaType;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!image) return json({ error: 'No image provided' }, 400);

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Extract the line items from this receipt as the specified JSON.' },
          ],
        },
      ],
    }),
  });

  if (!aiRes.ok) {
    const detail = await aiRes.text();
    console.error('anthropic error', aiRes.status, detail);
    return json({ error: 'Could not read the receipt. Please try again.' }, 502);
  }

  const payload = await aiRes.json();
  const text: string = payload?.content?.[0]?.text ?? '';
  const parsed = parseReceipt(text);
  if (!parsed) {
    console.error('unparseable model output', text.slice(0, 500));
    return json({ error: "Couldn't understand that receipt. Try a clearer photo." }, 422);
  }
  return json(parsed);
});

// Tolerate stray code fences / surrounding text around the JSON object.
function parseReceipt(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (!obj || !Array.isArray(obj.items)) return null;
    obj.items = obj.items
      .filter((it: { name?: unknown; price?: unknown }) => it && typeof it.name === 'string')
      .map((it: { name: string; quantity?: unknown; price?: unknown }) => ({
        name: it.name.trim(),
        quantity: Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
        price: Number.isFinite(Number(it.price)) && Number(it.price) > 0 ? Number(it.price) : null,
      }));
    return {
      merchant: typeof obj.merchant === 'string' ? obj.merchant : null,
      purchased_on: typeof obj.purchased_on === 'string' ? obj.purchased_on : null,
      currency: typeof obj.currency === 'string' ? obj.currency : null,
      items: obj.items,
    };
  } catch {
    return null;
  }
}
