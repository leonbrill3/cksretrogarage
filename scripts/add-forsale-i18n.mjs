import { readFileSync, writeFileSync } from 'node:fs';

// Per-locale additions for the For Sale / agent feature.
const T = {
  en: {
    nav: { forSale: 'For Sale' },
    home: { available: { eyebrow: 'For Sale', title: 'Available now.', viewAll: 'View all' } },
    forSale: {
      metaTitle: 'Cars for Sale',
      eyebrow: 'For Sale',
      title: 'Available now.',
      intro:
        'A curated selection of exceptional cars currently available — each one sourced, inspected and held to the standard we apply to every acquisition.',
      note: 'Each car is offered through one of our partners. Contact them directly for full details, history and a viewing.',
      empty: "No cars are listed for sale right now. Tell us what you're looking for and we'll source it.",
      emptyCta: 'Source a Car',
    },
    car: {
      forSaleBack: 'Back to For Sale',
      priceOnRequest: 'Price on application',
      specsHeading: 'Specification',
      locationLabel: 'Location',
      status: { available: 'Available', reserved: 'Reserved', sold: 'Sold' },
      spec: {
        mileage: 'Mileage',
        transmission: 'Transmission',
        engine: 'Engine',
        exterior: 'Exterior',
        interior: 'Interior',
        vin: 'Chassis · VIN',
      },
    },
    agent: {
      yourSpecialist: 'Your specialist',
      presentedBy: 'Presented by',
      whatsapp: 'WhatsApp',
      call: 'Call',
      email: 'Email',
      speaks: 'Speaks',
    },
    inquiry: {
      title: 'Request details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone (optional)',
      message: 'Message',
      messagePlaceholder: "I'm interested in this car — please send full details.",
      consent: 'I agree to be contacted about this enquiry.',
      submit: 'Send enquiry',
      sending: 'Sending…',
      success: "Thank you — we'll be in touch shortly.",
      error: 'Something went wrong. Please try again.',
    },
  },
  tr: {
    nav: { forSale: 'Satılık' },
    home: { available: { eyebrow: 'Satılık', title: 'Şimdi mevcut.', viewAll: 'Tümünü gör' } },
    forSale: {
      metaTitle: 'Satılık Otomobiller',
      eyebrow: 'Satılık',
      title: 'Şimdi mevcut.',
      intro:
        'Şu anda satışa sunulan, özenle seçilmiş istisnai otomobiller — her biri her alımda uyguladığımız standartta bulundu ve incelendi.',
      note: 'Her otomobil ortaklarımızdan biri aracılığıyla sunulmaktadır. Tüm detaylar, geçmiş ve görüntüleme için doğrudan onlarla iletişime geçin.',
      empty: 'Şu anda satılık otomobil bulunmuyor. Ne aradığınızı bize söyleyin, sizin için bulalım.',
      emptyCta: 'Otomobil Buldur',
    },
    car: {
      forSaleBack: 'Satılığa Dön',
      priceOnRequest: 'Fiyat için sorunuz',
      specsHeading: 'Teknik Özellikler',
      locationLabel: 'Konum',
      status: { available: 'Mevcut', reserved: 'Rezerve', sold: 'Satıldı' },
      spec: {
        mileage: 'Kilometre',
        transmission: 'Şanzıman',
        engine: 'Motor',
        exterior: 'Dış Renk',
        interior: 'İç Mekan',
        vin: 'Şasi · VIN',
      },
    },
    agent: {
      yourSpecialist: 'Uzmanınız',
      presentedBy: 'Sunan',
      whatsapp: 'WhatsApp',
      call: 'Ara',
      email: 'E-posta',
      speaks: 'Diller',
    },
    inquiry: {
      title: 'Bilgi isteyin',
      name: 'İsim',
      email: 'E-posta',
      phone: 'Telefon (isteğe bağlı)',
      message: 'Mesaj',
      messagePlaceholder: 'Bu otomobille ilgileniyorum — lütfen tüm detayları gönderin.',
      consent: 'Bu talep hakkında benimle iletişime geçilmesini kabul ediyorum.',
      submit: 'Gönder',
      sending: 'Gönderiliyor…',
      success: 'Teşekkürler — kısa süre içinde sizinle iletişime geçeceğiz.',
      error: 'Bir şeyler ters gitti. Lütfen tekrar deneyin.',
    },
  },
  es: {
    nav: { forSale: 'En Venta' },
    home: { available: { eyebrow: 'En Venta', title: 'Disponibles ahora.', viewAll: 'Ver todo' } },
    forSale: {
      metaTitle: 'Coches en Venta',
      eyebrow: 'En Venta',
      title: 'Disponibles ahora.',
      intro:
        'Una selección curada de automóviles excepcionales actualmente disponibles — cada uno encontrado, inspeccionado y mantenido según el estándar que aplicamos a cada adquisición.',
      note: 'Cada coche se ofrece a través de uno de nuestros socios. Contáctelos directamente para todos los detalles, historial y una visita.',
      empty: 'No hay coches en venta en este momento. Díganos qué busca y lo encontraremos.',
      emptyCta: 'Buscar un Coche',
    },
    car: {
      forSaleBack: 'Volver a En Venta',
      priceOnRequest: 'Precio a consultar',
      specsHeading: 'Especificaciones',
      locationLabel: 'Ubicación',
      status: { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido' },
      spec: {
        mileage: 'Kilometraje',
        transmission: 'Transmisión',
        engine: 'Motor',
        exterior: 'Exterior',
        interior: 'Interior',
        vin: 'Chasis · VIN',
      },
    },
    agent: {
      yourSpecialist: 'Su especialista',
      presentedBy: 'Presentado por',
      whatsapp: 'WhatsApp',
      call: 'Llamar',
      email: 'Correo',
      speaks: 'Idiomas',
    },
    inquiry: {
      title: 'Solicitar información',
      name: 'Nombre',
      email: 'Correo electrónico',
      phone: 'Teléfono (opcional)',
      message: 'Mensaje',
      messagePlaceholder: 'Estoy interesado en este coche — por favor, envíe todos los detalles.',
      consent: 'Acepto ser contactado sobre esta consulta.',
      submit: 'Enviar consulta',
      sending: 'Enviando…',
      success: 'Gracias — nos pondremos en contacto pronto.',
      error: 'Algo salió mal. Por favor, inténtelo de nuevo.',
    },
  },
  de: {
    nav: { forSale: 'Zu Verkaufen' },
    home: { available: { eyebrow: 'Zu Verkaufen', title: 'Jetzt verfügbar.', viewAll: 'Alle ansehen' } },
    forSale: {
      metaTitle: 'Fahrzeuge zu verkaufen',
      eyebrow: 'Zu Verkaufen',
      title: 'Jetzt verfügbar.',
      intro:
        'Eine kuratierte Auswahl außergewöhnlicher Fahrzeuge, die derzeit verfügbar sind — jedes beschafft, geprüft und nach dem Standard gehalten, den wir bei jeder Akquisition anlegen.',
      note: 'Jedes Fahrzeug wird über einen unserer Partner angeboten. Kontaktieren Sie diese direkt für alle Details, Historie und eine Besichtigung.',
      empty: 'Derzeit sind keine Fahrzeuge zum Verkauf gelistet. Sagen Sie uns, wonach Sie suchen, und wir beschaffen es.',
      emptyCta: 'Auto beschaffen',
    },
    car: {
      forSaleBack: 'Zurück zu Zu Verkaufen',
      priceOnRequest: 'Preis auf Anfrage',
      specsHeading: 'Spezifikation',
      locationLabel: 'Standort',
      status: { available: 'Verfügbar', reserved: 'Reserviert', sold: 'Verkauft' },
      spec: {
        mileage: 'Laufleistung',
        transmission: 'Getriebe',
        engine: 'Motor',
        exterior: 'Außen',
        interior: 'Innen',
        vin: 'Fahrgestell · VIN',
      },
    },
    agent: {
      yourSpecialist: 'Ihr Spezialist',
      presentedBy: 'Präsentiert von',
      whatsapp: 'WhatsApp',
      call: 'Anrufen',
      email: 'E-Mail',
      speaks: 'Sprachen',
    },
    inquiry: {
      title: 'Details anfragen',
      name: 'Name',
      email: 'E-Mail',
      phone: 'Telefon (optional)',
      message: 'Nachricht',
      messagePlaceholder: 'Ich interessiere mich für dieses Fahrzeug — bitte senden Sie alle Details.',
      consent: 'Ich stimme zu, bezüglich dieser Anfrage kontaktiert zu werden.',
      submit: 'Anfrage senden',
      sending: 'Senden…',
      success: 'Danke — wir melden uns in Kürze.',
      error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    },
  },
  nl: {
    nav: { forSale: 'Te Koop' },
    home: { available: { eyebrow: 'Te Koop', title: 'Nu beschikbaar.', viewAll: 'Bekijk alles' } },
    forSale: {
      metaTitle: "Auto's te koop",
      eyebrow: 'Te Koop',
      title: 'Nu beschikbaar.',
      intro:
        "Een samengestelde selectie uitzonderlijke auto's die nu beschikbaar zijn — elk gevonden, geïnspecteerd en gehouden volgens de standaard die wij bij elke aankoop hanteren.",
      note: 'Elke auto wordt aangeboden via een van onze partners. Neem rechtstreeks contact op voor alle details, historie en een bezichtiging.',
      empty: "Er staan momenteel geen auto's te koop. Vertel ons wat u zoekt en wij vinden het.",
      emptyCta: 'Auto laten zoeken',
    },
    car: {
      forSaleBack: 'Terug naar Te Koop',
      priceOnRequest: 'Prijs op aanvraag',
      specsHeading: 'Specificaties',
      locationLabel: 'Locatie',
      status: { available: 'Beschikbaar', reserved: 'Gereserveerd', sold: 'Verkocht' },
      spec: {
        mileage: 'Kilometerstand',
        transmission: 'Transmissie',
        engine: 'Motor',
        exterior: 'Exterieur',
        interior: 'Interieur',
        vin: 'Chassis · VIN',
      },
    },
    agent: {
      yourSpecialist: 'Uw specialist',
      presentedBy: 'Aangeboden door',
      whatsapp: 'WhatsApp',
      call: 'Bellen',
      email: 'E-mail',
      speaks: 'Talen',
    },
    inquiry: {
      title: 'Details aanvragen',
      name: 'Naam',
      email: 'E-mail',
      phone: 'Telefoon (optioneel)',
      message: 'Bericht',
      messagePlaceholder: 'Ik heb interesse in deze auto — stuur mij alle details.',
      consent: 'Ik ga akkoord met contact over deze aanvraag.',
      submit: 'Aanvraag versturen',
      sending: 'Versturen…',
      success: 'Bedankt — we nemen spoedig contact op.',
      error: 'Er ging iets mis. Probeer het opnieuw.',
    },
  },
};

// Deep-merge additions into the existing message object (objects merged, scalars set).
function merge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = merge(target[k] && typeof target[k] === 'object' ? target[k] : {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

for (const [loc, additions] of Object.entries(T)) {
  const path = new URL(`../src/messages/${loc}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  merge(json, additions);
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`updated ${loc}.json`);
}
