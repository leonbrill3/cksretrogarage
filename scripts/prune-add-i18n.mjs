import { readFileSync, writeFileSync } from 'node:fs';

// New localized label for the private quote page price.
const PRICE_LABEL = { en: 'Price', tr: 'Fiyat', es: 'Precio', de: 'Preis', nl: 'Prijs' };

const locales = ['en', 'tr', 'es', 'de', 'nl'];

for (const loc of locales) {
  const path = new URL(`../src/messages/${loc}.json`, import.meta.url);
  const j = JSON.parse(readFileSync(path, 'utf8'));

  // Remove keys tied to the old public For Sale tab.
  delete j.forSale;
  delete j.nav?.forSale;
  delete j.home?.available;
  delete j.car?.status;
  delete j.car?.priceOnRequest;

  // Add the quote namespace.
  j.quote = { priceLabel: PRICE_LABEL[loc] };

  writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
  console.log(`updated ${loc}.json`);
}
