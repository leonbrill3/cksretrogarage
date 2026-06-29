import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-auth';
import { COST_CATEGORIES } from '@/data/inventory';

export const runtime = 'nodejs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

// Reads an uploaded invoice (PDF or image) with Claude and returns structured
// fields the admin can then edit. Used to pre-fill add-on cost & purchase lines.
export async function POST(req: NextRequest) {
  if (
    process.env.ADMIN_PASSWORD &&
    !(await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'not_configured' }, { status: 200 });
  }

  let body: { fileData?: string; kind?: 'cost' | 'purchase' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const dataUrl = body.fileData || '';
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return NextResponse.json({ error: 'No file' }, { status: 400 });
  const [, mediaType, b64] = m;
  const isPdf = /pdf/i.test(mediaType);

  const fileBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } };

  const kind = body.kind === 'purchase' ? 'purchase' : 'cost';
  const prompt =
    kind === 'purchase'
      ? 'This is an invoice/receipt for PURCHASING a car. Extract the total purchase amount, the date, the seller/vendor name, and the invoice number. Use the record_invoice tool. If a field is unknown, leave it empty.'
      : 'This is an invoice/receipt for a cost spent on a car (parts, repairs, shipping, etc.). Extract the total amount, the date, the best-fit category, a short description of what it was for, and the vendor name. Use the record_invoice tool. If a field is unknown, leave it empty.';

  const tool = {
    name: 'record_invoice',
    description: 'Record the fields extracted from the invoice.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Total amount as a number, no currency symbol' },
        date: { type: 'string', description: 'Invoice date in YYYY-MM-DD format' },
        category: { type: 'string', enum: COST_CATEGORIES as unknown as string[], description: 'Best-fit cost category' },
        description: { type: 'string', description: 'Short description of the goods/services' },
        vendor: { type: 'string', description: 'Vendor / seller / supplier name' },
        invoiceNumber: { type: 'string', description: 'Invoice or receipt number' },
      },
      required: [],
    },
  };

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'record_invoice' },
        messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: prompt }] }],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: 'extraction_failed', detail: detail.slice(0, 300) }, { status: 200 });
    }
    const data = await r.json();
    const toolUse = (data.content || []).find((c: { type: string }) => c.type === 'tool_use');
    const fields = toolUse?.input || {};
    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    return NextResponse.json({ error: 'extraction_failed', detail: String(e) }, { status: 200 });
  }
}
