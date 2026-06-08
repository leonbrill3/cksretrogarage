# CK Retro Garage

Luxury classic-car acquisition website for **cksretrogarage.com**. A private acquisition house — sourcing, inspecting and safeguarding exceptional cars worldwide.

Built with **Next.js 15 (App Router) + Tailwind CSS + next-intl**.

## Languages

English (`en`), Turkish (`tr`), Spanish (`es`), German (`de`, for Switzerland), Dutch (`nl`).
URLs are locale-prefixed (`/en`, `/tr`, …) with `hreflang` SEO tags.

## Local development

```bash
npm install
npm run dev      # http://localhost:3000  → redirects to /en
npm run build    # production build
npm start        # serve the production build
```

## Project structure

```
src/
  app/[locale]/        # all pages (home, collection, process, about, storage, source, contact, privacy)
  app/api/source/      # sourcing-request form handler (region-routed email)
  components/          # Header, Footer, CarCard, Gallery, SourceForm, LanguageSwitcher, Reveal
  data/cars.ts         # the car inventory (edit here to add/remove cars)
  i18n/                # locale routing + config
  messages/*.json      # translations (181 keys per language)
public/cars/<slug>/    # optimized car photos (01.jpg, 02.jpg, …)
```

## Adding a car

1. Drop optimized photos into `public/cars/<slug>/` named `01.jpg`, `02.jpg`, …
2. Add an entry to `src/data/cars.ts` (set `imageCount` to the number of photos).
3. Translate the `tagline`/`description` if desired (currently English).

## The sourcing form

Submissions hit `/api/source`, which routes the lead by country:
Latin America → Andrés, Switzerland/Netherlands → Cenk, Türkiye/other → Cem.
Set `RESEND_API_KEY` (see `.env.example`) to send real emails; otherwise leads are logged to the server console.

## Deploy (recommended: Vercel)

1. Push this repo to GitHub.
2. Import it at https://vercel.com (framework auto-detected as Next.js).
3. Add the `RESEND_API_KEY` env var.
4. Add the domain `cksretrogarage.com` in Vercel → it gives you DNS records.
5. At GoDaddy, point the domain's DNS to Vercel (A record / CNAME as instructed). Domain stays registered at GoDaddy; site is hosted on Vercel.

## Outstanding before go-live

- **Photography**: current images are WhatsApp-compressed. Replace with high-res shots as available.
- **Legal**: have a lawyer finalize the privacy policy + cookie/GDPR consent banner.
- **Native review**: have native speakers review TR/ES/DE/NL, especially per-car copy.
- **Real stats & contact details**: confirm the homepage stat numbers and add phone/WhatsApp numbers.
```
