import agentsData from '../../content/agents.json';

// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for sales agents.
// Used by: the For Sale co-branded listings, the agent Share
// dashboards, lead routing (/api/source), and — via the
// contacts.ts back-compat shim — the footer, contact & about pages.
//
// Managed in /admin (commits content/agents.json to GitHub).
// ─────────────────────────────────────────────────────────────

export type Agent = {
  id: string;
  name: string;
  title: string; // e.g. "Partner"
  scope: string; // territory label, e.g. "USA, Türkiye & Netherlands"
  email: string;
  phone?: string; // E.164 for tel: links, e.g. "+31201234567"
  whatsapp?: string; // digits only for wa.me, e.g. "31612345678"
  languages?: string[];
  photo?: string; // filename under /public/agents/, e.g. "cenk.jpg"
  token: string; // secret used to reach the agent's Share dashboard
  // When false, the agent has a working share dashboard but is NOT shown
  // publicly (About / Contact / Footer). Defaults to true when omitted.
  public?: boolean;
  // Set when the agent accepts the Independent Sales Agent Agreement.
  acceptedTermsAt?: string;
  acceptedTermsVersion?: string;
  // Lowercase substrings matched against a user-supplied country to
  // route a lead to this agent.
  match: string[];
};

export const agents: Agent[] = agentsData as Agent[];

// Agents shown on the public About / Contact / Footer (public !== false).
export const publicAgents: Agent[] = agents.filter((a) => a.public !== false);

export const defaultEmail = 'contact@cksretrogarage.com';

export function getAgent(id: string | undefined | null): Agent | undefined {
  if (!id) return undefined;
  return agents.find((a) => a.id === id);
}

export function agentByToken(token: string | undefined | null): Agent | undefined {
  if (!token) return undefined;
  return agents.find((a) => a.token && a.token === token);
}

// Photo URL or null (the AgentCard falls back to initials when null).
// New uploads are absolute refs (/api/media/… or https://…); older ones are
// bare filenames under /public/agents/.
export function agentPhoto(agent: Agent): string | null {
  if (!agent.photo) return null;
  return /^(https?:)?\/\//.test(agent.photo) || agent.photo.startsWith('/')
    ? agent.photo
    : `/agents/${agent.photo}`;
}

// Route a country string to the responsible agent (or undefined → house inbox).
export function routeAgentFor(country = ''): Agent | undefined {
  const c = country.trim().toLowerCase();
  if (!c) return undefined;
  return agents.find((a) => a.match.some((m) => c.includes(m)));
}

export function routeEmailFor(country = ''): string {
  return routeAgentFor(country)?.email || defaultEmail;
}
