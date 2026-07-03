'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  type Campaign,
  type CampaignFind,
  type CampaignRun,
  type Country,
  formatMiles,
} from '@/data/campaigns';

const field =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const lbl = 'block text-xs font-medium uppercase tracking-wide text-neutral-500 mb-1';

function usd(n?: number) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function CampaignEditor({
  campaign,
  isNew,
  finds,
  lastRun,
  sourcesReady,
  sourceLabels,
}: {
  campaign: Campaign;
  isNew: boolean;
  finds: CampaignFind[];
  lastRun?: CampaignRun;
  sourcesReady: boolean;
  sourceLabels: { marketcheck: boolean; web: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState(campaign.name);
  const [make, setMake] = useState(campaign.make);
  const [model, setModel] = useState(campaign.model);
  const [trimKeywords, setTrimKeywords] = useState(campaign.trimKeywords || '');
  const [yearMin, setYearMin] = useState(campaign.yearMin ? String(campaign.yearMin) : '');
  const [yearMax, setYearMax] = useState(campaign.yearMax ? String(campaign.yearMax) : '');
  const [maxMileage, setMaxMileage] = useState(campaign.maxMileage ? String(campaign.maxMileage) : '');
  const [priceMin, setPriceMin] = useState(campaign.priceMin ? String(campaign.priceMin) : '');
  const [priceMax, setPriceMax] = useState(campaign.priceMax ? String(campaign.priceMax) : '');
  const [countries, setCountries] = useState<Country[]>(campaign.countries.length ? campaign.countries : ['US']);
  const [runMorning, setRunMorning] = useState(campaign.runMorning);
  const [runAfternoon, setRunAfternoon] = useState(campaign.runAfternoon);
  const [alertEmail, setAlertEmail] = useState(campaign.alertEmail || '');
  const [status, setStatus] = useState<Campaign['status']>(campaign.status);

  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [showGone, setShowGone] = useState(false);

  const toggleCountry = (c: Country) =>
    setCountries((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  function payload() {
    return {
      id: campaign.id || undefined,
      name, make, model, trimKeywords,
      yearMin, yearMax, maxMileage, priceMin, priceMax,
      countries, runMorning, runAfternoon, alertEmail, status,
    };
  }

  async function save(): Promise<string | null> {
    if (!make.trim() || !model.trim()) {
      setMsg('Make and model are required.');
      return null;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: payload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      return data.id as string;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
      setBusy(false);
      return null;
    }
  }

  async function saveAndBack() {
    const id = await save();
    if (id) {
      router.push('/admin/campaigns');
      router.refresh();
    }
  }

  async function runNow() {
    // Save first so the run uses current criteria (and a new campaign exists).
    const id = await save();
    setBusy(false);
    if (!id) return;
    setRunning(true);
    setMsg('Searching the web for live listings…');
    try {
      const res = await fetch('/api/admin/campaigns/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Run failed');
      const r = data.run as CampaignRun;
      setMsg(`Done: ${r.found} matched · ${r.added} new · ${r.priceDrops} price drop(s)${r.error ? ` · note: ${r.error}` : ''}`);
      if (isNew) router.replace(`/admin/campaigns/${id}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  async function del() {
    if (!confirm('Delete this campaign and all its finds? This cannot be undone.')) return;
    setBusy(true);
    await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteId: campaign.id }),
    });
    router.push('/admin/campaigns');
    router.refresh();
  }

  const visible = finds.filter((f) => showGone || f.status !== 'gone');
  const goneCount = finds.filter((f) => f.status === 'gone').length;

  function ledgerHref(f: CampaignFind) {
    const p = new URLSearchParams();
    if (f.vin) p.set('vin', f.vin);
    if (f.make) p.set('make', f.make);
    if (f.model) p.set('model', f.model);
    if (f.year) p.set('year', String(f.year));
    if (f.mileage != null) p.set('mileage', `${f.mileage} mi`);
    return `/admin/inventory/new?${p.toString()}`;
  }

  return (
    <div className="mt-6 space-y-8">
      {!sourcesReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠ No sourcing provider is configured yet, so “Run now” won’t find anything. Set
          <code className="mx-1">ANTHROPIC_API_KEY</code> and/or <code className="mx-1">MARKETCHECK_API_KEY</code> on Render.
        </div>
      )}

      {/* ---- Criteria form ---- */}
      <div className="rounded-lg border border-neutral-200 p-5">
        <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-900">What to hunt</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={lbl}>Campaign name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="599 GTB gated manuals" />
          </div>
          <div><label className={lbl}>Make</label><input value={make} onChange={(e) => setMake(e.target.value)} className={field} placeholder="Ferrari" /></div>
          <div><label className={lbl}>Model</label><input value={model} onChange={(e) => setModel(e.target.value)} className={field} placeholder="599" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Must-match keywords (optional)</label><input value={trimKeywords} onChange={(e) => setTrimKeywords(e.target.value)} className={field} placeholder="gated manual 6-speed" /></div>
          <div><label className={lbl}>Year min</label><input value={yearMin} onChange={(e) => setYearMin(e.target.value)} className={field} placeholder="2006" inputMode="numeric" /></div>
          <div><label className={lbl}>Year max</label><input value={yearMax} onChange={(e) => setYearMax(e.target.value)} className={field} placeholder="2012" inputMode="numeric" /></div>
          <div><label className={lbl}>Max mileage (mi)</label><input value={maxMileage} onChange={(e) => setMaxMileage(e.target.value)} className={field} placeholder="40000" inputMode="numeric" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Price min ($)</label><input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className={field} placeholder="100000" inputMode="numeric" /></div>
            <div><label className={lbl}>Price max ($)</label><input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className={field} placeholder="250000" inputMode="numeric" /></div>
          </div>
          <div>
            <label className={lbl}>Countries</label>
            <div className="flex gap-4 pt-1.5">
              {(['US', 'CA'] as Country[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input type="checkbox" checked={countries.includes(c)} onChange={() => toggleCountry(c)} /> {c === 'US' ? 'United States' : 'Canada'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>Monitor cadence</label>
            <div className="flex gap-4 pt-1.5">
              <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={runMorning} onChange={(e) => setRunMorning(e.target.checked)} /> Morning</label>
              <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={runAfternoon} onChange={(e) => setRunAfternoon(e.target.checked)} /> Afternoon</label>
            </div>
          </div>
          <div><label className={lbl}>Alert email (optional)</label><input value={alertEmail} onChange={(e) => setAlertEmail(e.target.value)} className={field} placeholder="leonbrill@gmail.com" /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as Campaign['status'])} className={field}>
              <option value="active">Active (monitored)</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={runNow} disabled={busy || running} className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
            {running ? 'Searching…' : '⚡ Run now'}
          </button>
          <button type="button" onClick={saveAndBack} disabled={busy || running} className="rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-900 disabled:opacity-50">
            {busy ? 'Saving…' : 'Save'}
          </button>
          {!isNew && (
            <button type="button" onClick={del} disabled={busy || running} className="ml-auto text-sm text-neutral-400 hover:text-red-600">Delete campaign</button>
          )}
        </div>
        {msg && <p className="mt-3 text-sm font-medium text-neutral-700">{msg}</p>}
        <p className="mt-3 text-xs text-neutral-400">
          Sources: {sourceLabels.web ? 'Web search (Claude)' : null}{sourceLabels.web && sourceLabels.marketcheck ? ' + ' : ''}{sourceLabels.marketcheck ? 'Marketcheck' : null}
          {!sourceLabels.web && !sourceLabels.marketcheck ? 'none configured' : ''}
          {lastRun ? ` · last run ${new Date(lastRun.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })}` : ''}
        </p>
      </div>

      {/* ---- Results ---- */}
      {!isNew && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Finds ({finds.filter((f) => f.status !== 'gone').length} active)
            </div>
            {goneCount > 0 && (
              <button type="button" onClick={() => setShowGone((s) => !s)} className="text-xs text-neutral-500 hover:text-neutral-900">
                {showGone ? 'Hide' : 'Show'} {goneCount} removed
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-neutral-500">
              No finds yet. Click <span className="font-medium text-neutral-900">⚡ Run now</span> to search the web.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visible.map((f) => (
                <div key={f.id} className={`overflow-hidden rounded-lg border ${f.status === 'gone' ? 'border-neutral-200 opacity-50' : f.status === 'price_drop' ? 'border-amber-300' : 'border-neutral-200'}`}>
                  {f.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.photo} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-neutral-100 text-neutral-400 text-sm">No photo</div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-neutral-900">{f.title}</div>
                      {f.status === 'price_drop' && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">Price drop</span>}
                      {f.status === 'gone' && <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">Removed</span>}
                    </div>
                    <div className="mt-1 font-serif text-lg text-neutral-900">{usd(f.price)}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {[f.mileage != null ? formatMiles(f.mileage) : null, f.location, f.dealer].filter(Boolean).join(' · ')}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-400">
                      {f.source} · first seen {new Date(f.firstSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">View listing ↗</a>
                      <Link href={ledgerHref(f)} className="font-medium text-neutral-700 hover:underline">Add to ledger →</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
