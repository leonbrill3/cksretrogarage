// Minimal GitHub "commit multiple files in one commit" helper using the Git Data API.
// Powers the admin panel's Git-as-CMS persistence.

const API = 'https://api.github.com';

type TextFile = { path: string; content: string };
type BinaryFile = { path: string; base64: string };

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPO must be set');
  }
  return { token, repo, branch };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gh(path: string, init?: RequestInit) {
  const { token } = cfg();
  // Retry transient auth/rate/5xx failures — GitHub occasionally rejects an
  // otherwise-valid token on the first write from a server IP, then accepts it.
  const RETRYABLE = new Set([401, 403, 429, 500, 502, 503, 504]);
  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (res.ok) return res.json();
    const body = await res.text();
    lastErr = `GitHub ${path} -> ${res.status}: ${body.slice(0, 200)}`;
    if (!RETRYABLE.has(res.status) || attempt === 3) break;
    await sleep(600 * (attempt + 1));
  }
  throw new Error(lastErr);
}

// Read and parse a JSON file from the repo (latest committed version on the branch).
export async function getRepoJson<T>(path: string): Promise<T> {
  const { repo, branch } = cfg();
  const data = await gh(`/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`);
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return JSON.parse(content) as T;
}

export async function commitFiles(opts: {
  message: string;
  textFiles?: TextFile[];
  binaryFiles?: BinaryFile[];
  deletePaths?: string[];
}): Promise<{ commitSha: string }> {
  const { repo, branch } = cfg();
  const base = `/repos/${repo}/git`;

  // 1. Current branch head + base tree
  const ref = await gh(`${base}/ref/heads/${branch}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh(`${base}/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  // 2. Upload binary blobs (images)
  const tree: Array<Record<string, unknown>> = [];
  for (const f of opts.binaryFiles || []) {
    const blob = await gh(`${base}/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: f.base64, encoding: 'base64' }),
    });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  // 3. Text files inline
  for (const f of opts.textFiles || []) {
    tree.push({ path: f.path, mode: '100644', type: 'blob', content: f.content });
  }

  // 4. Deletions (sha: null removes from the new tree)
  for (const p of opts.deletePaths || []) {
    tree.push({ path: p, mode: '100644', type: 'blob', sha: null });
  }

  // 5. New tree -> commit -> move branch
  const newTree = await gh(`${base}/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  const commit = await gh(`${base}/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: opts.message,
      tree: newTree.sha,
      parents: [baseCommitSha],
    }),
  });
  await gh(`${base}/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return { commitSha: commit.sha };
}
