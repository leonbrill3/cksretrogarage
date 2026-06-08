export type Car = {
  slug: string;
  year: number;
  make: string;
  model: string;
  category: 'grand-touring' | 'sports' | 'rally' | 'collector';
  // Short evocative line shown on cards / hero.
  tagline: string;
  // Longer editorial paragraph for the detail page.
  description: string;
  // What was inspected — reinforces the attention-to-detail brand.
  inspection: string[];
  // Number of optimized images present under /public/cars/<slug>/01.jpg ...
  imageCount: number;
  featured?: boolean;
  // Optional video assets (vertical reels). `clip` is a short muted loop shown
  // near the top; `film` is the full reel played with sound below the gallery.
  clip?: string;
  film?: string;
  filmPoster?: string;
};

// NOTE: Photography is sourced from the company's real past acquisitions.
// Editorial copy below is in English for launch — have a native speaker review
// per-car narrative before translating into TR / ES / DE / NL.
export const cars: Car[] = [
  {
    slug: '1982-ferrari-308-gtsi',
    year: 1982,
    make: 'Ferrari',
    model: '308 GTSi',
    category: 'grand-touring',
    tagline: 'The Pininfarina wedge that defined a generation.',
    description:
      "A landmark of Ferrari's analog era — Pininfarina lines, a fuel-injected V8 behind the seats, and the targa roof that made the 308 an icon. This example was acquired for its honesty: correct panels, a sympathetic interior, and a mechanical package gone through end to end.",
    inspection: [
      'Engine compression and leak-down verified across all cylinders',
      'Bodywork inspected panel-by-panel for originality and accident history',
      'Cam belts, tensioners and service history confirmed',
      'Interior, electrics and targa seals checked in full',
    ],
    imageCount: 20,
    featured: true,
  },
  {
    slug: 'ferrari-f355-challenge',
    year: 1999,
    make: 'Ferrari',
    model: 'F355 Challenge',
    category: 'sports',
    tagline: 'A factory-built racer — one of roughly 108 ever made.',
    description:
      'The F355 Challenge is one of the most desirable modern classic Ferraris. Ferrari built only about 108 factory F355 Challenge cars for the Ferrari Challenge racing series — making this a genuinely rare, motorsport-bred machine. Sourced for its authenticity and the integrity of its factory Challenge specification.',
    inspection: [
      'Factory Challenge specification and components authenticated',
      'Engine and driveline inspected to motorsport standard',
      'Race chassis, roll cage and safety equipment verified',
      'Provenance within the Ferrari Challenge series confirmed',
    ],
    imageCount: 7,
    featured: true,
  },
  {
    slug: '1988-bmw-e30-m3',
    year: 1988,
    make: 'BMW',
    model: 'E30 M3',
    category: 'sports',
    tagline: 'Homologation legend. The purest M car ever built.',
    description:
      'Born to win in touring car racing, the E30 M3 is the benchmark by which all M cars are judged. Boxed arches, the high-revving S14 four-cylinder, and a chassis of rare clarity. Selected for its matching-numbers integrity and unmodified specification.',
    inspection: [
      'S14 engine number matched to chassis documentation',
      'Originality of arches, glass and trim confirmed',
      'Full corrosion survey on shells known to rust',
      'Gearbox, differential and suspension assessed under load',
    ],
    imageCount: 20,
    featured: true,
  },
  {
    slug: '1993-mercedes-benz-500e',
    year: 1993,
    make: 'Mercedes-Benz',
    model: '500E',
    category: 'grand-touring',
    tagline: 'The Porsche-built Q-car. A wolf in a tailored suit.',
    description:
      'Hand-assembled in part by Porsche, the 500E hid a V8 inside the understated W124 body. Engineering integrity above showmanship — exactly the kind of car the connoisseur seeks. Acquired with documented history and a faultless mechanical bill of health.',
    inspection: [
      'V8 powertrain and hydraulics fully serviced and verified',
      'W124 structure surveyed for corrosion and prior repair',
      'Service records and provenance authenticated',
      'Electrics, climate and interior trim function confirmed',
    ],
    imageCount: 19,
    featured: true,
  },
  {
    slug: '1995-mercedes-benz-r129-sl320',
    year: 1995,
    make: 'Mercedes-Benz',
    model: 'R129 SL320',
    category: 'grand-touring',
    tagline: 'Bruno Sacco at his finest. Built without compromise.',
    description:
      "The R129 SL is widely regarded as one of the best-built cars Mercedes ever produced — a roadster engineered like a bank vault. This SL320 was chosen for its condition, its complete history, and the integrity of its folding hard-top and electronics.",
    inspection: [
      'Roof mechanism and hydraulics cycled and verified',
      'Body and underside surveyed for originality',
      'Complete service history authenticated',
      'All electronics and comfort systems tested',
    ],
    imageCount: 20,
  },
  {
    slug: '1996-lancia-delta-hf-integrale-evo-ii',
    year: 1996,
    make: 'Lancia',
    model: 'Delta HF Integrale Evo II',
    category: 'rally',
    tagline: 'The most decorated rally car of all time, road-legal.',
    description:
      'The Evoluzione II is the final, most desirable evolution of the car that dominated the World Rally Championship. Turbocharged, four-wheel-drive and ferociously rare. Sourced for its authenticity and uncompromised originality.',
    inspection: [
      'Turbo system and four-wheel-drive driveline verified',
      'Originality of bodywork and unique Evo II details confirmed',
      'Corrosion survey on critical structural points',
      'Service history and matching components authenticated',
    ],
    imageCount: 12,
    featured: true,
  },
  {
    slug: '2001-bmw-z8',
    year: 2001,
    make: 'BMW',
    model: 'Z8',
    category: 'sports',
    tagline: 'A modern classic, designed to be timeless from day one.',
    description:
      "Henrik Fisker's neo-retro masterpiece, powered by the M5's V8 and built in strictly limited numbers. The Z8 was engineered as an instant collectible — and has become exactly that. Acquired with low ownership and impeccable presentation.",
    inspection: [
      'S62 V8 powertrain inspected and verified',
      'Aluminium spaceframe and panels assessed for originality',
      'Soft-top, electronics and interior confirmed faultless',
      'Ownership chain and service history documented',
    ],
    imageCount: 10,
  },
  {
    slug: 'ferrari-599',
    year: 2008,
    make: 'Ferrari',
    model: '599 & Select Acquisitions',
    category: 'grand-touring',
    tagline: 'A window into recent acquisitions across the collection.',
    description:
      'A selection from recent acquisitions — including the front-engined V12 grand tourer that carried Ferrari into the modern era. Representative of the breadth of cars we are trusted to source, inspect and place with the right owners.',
    inspection: [
      'Each car independently inspected to the same exacting standard',
      'Provenance and documentation authenticated',
      'Mechanical and cosmetic condition verified in person',
      'Stored and maintained in climate-controlled custody',
    ],
    imageCount: 20,
  },
];

export function getCar(slug: string): Car | undefined {
  return cars.find((c) => c.slug === slug);
}

export function carImages(car: Car): string[] {
  return Array.from(
    { length: car.imageCount },
    (_, i) => `/cars/${car.slug}/${String(i + 1).padStart(2, '0')}.jpg`,
  );
}

export function carTitle(car: Car): string {
  return `${car.year} ${car.make} ${car.model}`;
}
