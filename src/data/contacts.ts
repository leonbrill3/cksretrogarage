// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for regional contacts.
// Used by: the footer, the contact page, and the sourcing-form
// email routing (/api/source). Change a territory here and it
// updates everywhere.
//
// Display labels (territory names per language) live in the
// `contacts` namespace of src/messages/*.json, keyed by `id`.
// ─────────────────────────────────────────────────────────────

export type ContactId = 'andres' | 'cenk';

export type Contact = {
  id: ContactId;
  name: string;
  email: string;
  // Lowercase substrings matched against the user-supplied country
  // (multiple spellings / languages) to route a lead to this person.
  match: string[];
};

export const contacts: Contact[] = [
  {
    id: 'andres',
    name: 'Andrés',
    email: 'andres@cksretrogarage.com',
    // Latin America + Switzerland
    match: [
      'argentina',
      'uruguay',
      'peru',
      'perú',
      'colombia',
      'panama',
      'panamá',
      'mexico',
      'méxico',
      'switzerland',
      'schweiz',
      'suisse',
      'svizzera',
      'suiza',
    ],
  },
  {
    id: 'cenk',
    name: 'Cenk Köse',
    email: 'cenk@cksretrogarage.com',
    // USA, Türkiye, Netherlands
    match: [
      'usa',
      'u.s.',
      'united states',
      'estados unidos',
      'turkey',
      'turkiye',
      'türkiye',
      'turkei',
      'türkei',
      'turquia',
      'turquía',
      'netherlands',
      'nederland',
      'holland',
      'niederlande',
      'países bajos',
      'paises bajos',
    ],
  },
];

// Fallback inbox for countries that don't match a specific contact.
export const defaultEmail = 'contact@cksretrogarage.com';

export function routeEmailFor(country = ''): string {
  const c = country.trim().toLowerCase();
  if (!c) return defaultEmail;
  for (const contact of contacts) {
    if (contact.match.some((m) => c.includes(m))) return contact.email;
  }
  return defaultEmail;
}
