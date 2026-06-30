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

  let body: { fileData?: string; kind?: 'cost' | 'purchase' | 'wire' };
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

  const kind = body.kind === 'purchase' ? 'purchase' : body.kind === 'wire' ? 'wire' : 'cost';
  const prompt =
    kind === 'purchase'
      ? 'This is a bill of sale / purchase invoice for BUYING a car. Extract: the TOTAL purchase price of the vehicle — the full agreed price, NOT the remaining balance. If the document shows a deposit / down payment already paid and a balance due, the total price is (deposit + balance due); put that full price in `amount`, the deposit already paid in `deposit`, and the remaining balance due in `balanceDue`. Also extract the date, the seller/vendor name, the invoice number, AND the vehicle details — VIN, year, make, model, trim, exterior color, and mileage/odometer reading if shown. Use the record_invoice tool. If a field is unknown, leave it empty.'
      : kind === 'wire'
        ? 'This is a wire transfer / bank payment confirmation related to buying or selling a car. Extract: the amount transferred, the date, the wire reference / confirmation number, and the counterparty name (the beneficiary/recipient for an outgoing payment, or the sender for an incoming one). If a VIN or vehicle is referenced anywhere, include it in the description. Use the record_invoice tool. If a field is unknown, leave it empty.'
        : 'This is an invoice/receipt for a cost spent on a car (parts, repairs, shipping, etc.). Extract the total amount, the date, the best-fit category, a short description of what it was for, and the vendor name. Use the record_invoice tool. If a field is unknown, leave it empty.';

  const tool = {
    name: 'record_invoice',
    description: 'Record the fields extracted from the invoice.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Total amount as a number, no currency symbol. For a car purchase this is the FULL vehicle price (deposit + balance due), never the balance alone.' },
        deposit: { type: 'number', description: 'Deposit / down payment already paid toward a car purchase, if shown' },
        balanceDue: { type: 'number', description: 'Remaining balance still owed after the deposit, if shown' },
        date: { type: 'string', description: 'Invoice date in YYYY-MM-DD format' },
        category: { type: 'string', enum: COST_CATEGORIES as unknown as string[], description: 'Best-fit cost category' },
        description: { type: 'string', description: 'Short description of the goods/services' },
        vendor: { type: 'string', description: 'Vendor / seller / supplier name' },
        invoiceNumber: { type: 'string', description: 'Invoice or receipt number' },
        reference: { type: 'string', description: 'Wire reference / payment confirmation number' },
        counterparty: { type: 'string', description: 'Wire counterparty — beneficiary (outgoing) or sender (incoming)' },
        // Vehicle details (from a bill of purchase)
        vin: { type: 'string', description: 'Vehicle Identification Number (VIN)' },
        vehicleYear: { type: 'number', description: 'Model year of the vehicle' },
        make: { type: 'string', description: 'Vehicle make / manufacturer, e.g. Ferrari' },
        model: { type: 'string', description: 'Vehicle model, e.g. 599' },
        trim: { type: 'string', description: 'Vehicle trim / variant' },
        color: { type: 'string', description: 'Exterior color' },
        mileage: { type: 'string', description: 'Mileage / odometer reading' },
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
