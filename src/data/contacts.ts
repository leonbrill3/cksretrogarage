// ─────────────────────────────────────────────────────────────
// BACK-COMPAT SHIM. The real source of truth is now src/data/agents.ts
// (content/agents.json). This module preserves the older `contacts`
// API so the footer, contact page and about page keep working.
//
// Display labels (territory names per language) live in the
// `contacts` namespace of src/messages/*.json, keyed by `id`, with
// the agent's stored `scope` used as a fallback for agents added
// after launch.
// ─────────────────────────────────────────────────────────────

import { publicAgents, defaultEmail as agentDefaultEmail, routeEmailFor as routeAgentEmail } from './agents';

export type ContactId = string;

export type Contact = {
  id: string;
  name: string;
  email: string;
  scope: string;
  match: string[];
};

export const contacts: Contact[] = publicAgents.map((a) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  scope: a.scope,
  match: a.match,
}));

export const defaultEmail = agentDefaultEmail;

export function routeEmailFor(country = ''): string {
  return routeAgentEmail(country);
}
