// Internal buy/sell ledger — one record per physical car CK acquires. This is
// CONFIDENTIAL (costs, invoices, margins) and must never be exposed publicly.
// All amounts are in USD. Stored in the DB under the 'inventory' key.

// A reference to an uploaded document (invoice / bill of sale), served via
// /api/media/<id>. `name` keeps the original filename for display.
export type FileRef = { url: string; name?: string };

// A single add-on cost line item (parts, repairs, shipping, etc.).
export type CostItem = {
  id: string;
  category: string;
  description?: string;
  amount: number; // USD
  date?: string; // YYYY-MM-DD
  invoice?: FileRef | null;
};

export type SaleInfo = {
  price?: number; // USD
  date?: string; // YYYY-MM-DD
  buyer?: string;
  billOfSale?: FileRef | null; // required to mark a car Sold
  saleInvoice?: FileRef | null;
};

export type InventoryStatus = 'in_stock' | 'for_sale' | 'sold';

export type InventoryRecord = {
  id: string;
  vin: string;
  year?: number;
  make: string;
  model: string;
  trim?: string;
  color?: string;
  mileage?: string;
  status: InventoryStatus;
  listingSlug?: string; // optional link to a public collection car

  // Purchase
  purchaseCost: number; // USD
  purchaseDate?: string;
  purchaseInvoiceNo?: string;
  seller?: string;
  purchaseInvoice?: FileRef | null;

  // Add-on costs
  costs: CostItem[];

  // Sale (completed only once a Bill of Sale is uploaded)
  sale?: SaleInfo;

  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const COST_CATEGORIES = [
  'Parts',
  'Repairs',
  'Shipping',
  'Import/Duty',
  'Commission',
  'Detailing',
  'Storage',
  'Other',
] as const;

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  in_stock: 'In Stock',
  for_sale: 'For Sale',
  sold: 'Sold',
};

// ----- Computed totals -----
export function addOnsTotal(r: InventoryRecord): number {
  return (r.costs || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

export function totalCost(r: InventoryRecord): number {
  return (Number(r.purchaseCost) || 0) + addOnsTotal(r);
}

// Profit is only meaningful once a sale price exists.
export function profit(r: InventoryRecord): number | undefined {
  const price = r.sale?.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) return undefined;
  return price - totalCost(r);
}

// A car can only be marked Sold once its Bill of Sale is uploaded.
export function canMarkSold(r: InventoryRecord): boolean {
  return !!r.sale?.billOfSale?.url;
}

export function formatUSD(amount: number | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function vehicleTitle(r: InventoryRecord): string {
  return [r.year, r.make, r.model].filter(Boolean).join(' ').trim() || r.vin || 'Untitled';
}
