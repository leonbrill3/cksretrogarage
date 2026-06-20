'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Agent } from '@/data/agents';

const SITE = 'https://cksretrogarage.com';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resizeFile(file: File, max = 600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = () => (img.src = reader.result as string);
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        const r = Math.min(max / width, max / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AgentEditor({ agent, isNew }: { agent: Agent; isNew: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [id, setId] = useState(agent.id);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [name, setName] = useState(agent.name);
  const [title, setTitle] = useState(agent.title || 'Partner');
  const [scope, setScope] = useState(agent.scope || '');
  const [email, setEmail] = useState(agent.email || '');
  const [phone, setPhone] = useState(agent.phone || '');
  const [whatsapp, setWhatsapp] = useState(agent.whatsapp || '');
  const [languages, setLanguages] = useState((agent.languages || []).join(', '));
  const [match, setMatch] = useState((agent.match || []).join('\n'));
  const [isPublic, setIsPublic] = useState(agent.public !== false);

  const existingPhoto = agent.photo
    ? /^(https?:)?\/\//.test(agent.photo) || agent.photo.startsWith('/')
      ? agent.photo
      : `/agents/${agent.photo}`
    : '';
  const [photoData, setPhotoData] = useState<string | null>(null);
  const photoPreview = photoData || existingPhoto;

  const [token, setToken] = useState(agent.token || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const shareLink = token ? `${SITE}/agent/${token}` : '';

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhotoData(await resizeFile(file));
    } catch {
      /* ignore */
    }
  }

  async function copyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', shareLink);
    }
  }

  async function save() {
    setStatus('saving');
    setMessage('');
    const payload = {
      isNew,
      originalId: agent.id || undefined,
      agent: {
        id: id.trim(),
        name: name.trim(),
        title: title.trim(),
        scope: scope.trim(),
        email: email.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        match: match.split('\n').map((s) => s.trim()).filter(Boolean),
        token: token || undefined,
        public: isPublic,
      },
      photo: photoData ? { data: photoData, ext: 'jpg' } : null,
    };
    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus('done');
      if (d.token) setToken(d.token);
      setMessage('Saved ✓ — live now.');
      if (isNew) setTimeout(() => router.push(`/admin/agents/${d.id}`), 1200);
    } else {
      setStatus('error');
      setMessage(d.error || 'Save failed');
    }
  }

  async function del() {
    if (!confirm(`Delete agent ${agent.name}? This cannot be undone.`)) return;
    setStatus('saving');
    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAgent: true, originalId: agent.id }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus('done');
      setMessage('Deleted. Redirecting…');
      setTimeout(() => router.push('/admin'), 1000);
    } else {
      setStatus('error');
      setMessage(d.error || 'Delete failed');
    }
  }

  const field = 'w-full border border-bone/15 bg-ink-800 px-3 py-2.5 text-bone focus:border-brass focus:outline-none';
  const label = 'mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-bone-dim';

  return (
    <div className="mt-8 space-y-8 pb-24">
      <section className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-ink-700">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-bone-dim">No photo</div>
          )}
        </div>
        <div>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-2">
            {photoPreview ? 'Change photo' : 'Add photo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickPhoto} />
          <p className="mt-2 text-xs text-bone-dim">Square headshot works best.</p>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label}>Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (isNew && !idTouched) setId(slugify(e.target.value));
            }}
            className={field}
          />
        </div>
        <div>
          <label className={label}>ID (URL key)</label>
          <input
            value={id}
            onChange={(e) => { setId(e.target.value); setIdTouched(true); }}
            className={field}
            disabled={!isNew}
          />
        </div>
        <div>
          <label className={label}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Partner" />
        </div>
        <div>
          <label className={label}>Territory / scope</label>
          <input value={scope} onChange={(e) => setScope(e.target.value)} className={field} placeholder="USA, Türkiye & Netherlands" />
        </div>
        <div>
          <label className={label}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>Phone (for tap-to-call)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="+31201234567" />
        </div>
        <div>
          <label className={label}>WhatsApp number (digits only)</label>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={field} placeholder="31612345678" />
        </div>
        <div>
          <label className={label}>Languages (comma separated)</label>
          <input value={languages} onChange={(e) => setLanguages(e.target.value)} className={field} placeholder="English, Türkçe" />
        </div>
      </section>

      <section>
        <label className={label}>Countries this agent covers (one per line)</label>
        <textarea
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          rows={5}
          className={field}
          placeholder={'usa\nturkey\nnetherlands'}
        />
        <p className="mt-2 text-xs text-bone-dim">
          Lowercase country names/spellings. Leads from these countries route to this agent.
        </p>
      </section>

      <section>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-1 accent-oxblood"
          />
          <span>
            <span className="text-sm">Show on public site (About, Contact, Footer)</span>
            <span className="mt-1 block text-xs text-bone-dim">
              Leave off for agents who only need a private share link and shouldn&apos;t appear as a
              public representative yet.
            </span>
          </span>
        </label>
      </section>

      {shareLink && (
        <section className="border border-brass/30 bg-ink-800 p-5">
          <div className={label}>Private share dashboard (give this to the agent)</div>
          <div className="flex flex-wrap items-center gap-3">
            <code className="break-all text-sm text-brass">{shareLink}</code>
            <button onClick={copyLink} className="btn-ghost !py-1.5 !px-3 text-xs">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <a
              href={shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !py-1.5 !px-3 text-xs"
            >
              Open share dashboard ↗
            </a>
          </div>
          <p className="mt-3 text-xs text-bone-dim">
            Send the link to the agent — or open it yourself to share listings on their behalf.
          </p>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-4 border-t border-bone/10 pt-6">
        <button onClick={save} disabled={status === 'saving'} className="btn-primary disabled:opacity-50">
          {status === 'saving' ? 'Saving…' : isNew ? 'Create agent' : 'Save changes'}
        </button>
        {!isNew && (
          <button onClick={del} disabled={status === 'saving'} className="text-sm text-oxblood-light hover:text-bone">
            Delete agent
          </button>
        )}
        {message && (
          <span className={`text-sm ${status === 'error' ? 'text-oxblood-light' : 'text-brass'}`}>{message}</span>
        )}
      </section>
    </div>
  );
}
