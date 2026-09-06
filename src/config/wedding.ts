// Edit this file to set the real wedding details. Nothing else needs to change.

export type WeddingConfig = {
  /** Public origin the card is served from. Used for OG tags and absolute URLs. */
  siteUrl: string;
  /**
   * Path to the bundled background-music track under `public/`, or `null`
   * for no music. Drop an MP3 into `public/music/` and set this to e.g.
   * "/music/preset-1.mp3". Left null so the card never links a file that
   * isn't there. An admin can override this later from /admin/settings.
   */
  presetMusicPath: string | null;
  /**
   * How the RSVP form asks for headcount:
   *  - "adultsChildren": separate Dewasa / Kanak-kanak steppers
   *  - "total":          one "Jumlah kehadiran" dropdown
   *  - "none":           don't ask at all (name, phone and ucapan only)
   */
  rsvpPaxMode: "adultsChildren" | "total" | "none";
  /**
   * Whether the public invitation is open.
   *  - "live":        normal
   *  - "maintenance": temporarily closed, come back later
   *  - "ended":       the wedding has happened
   * Anything other than "live" replaces the card with a notice AND closes
   * the public write endpoints — see src/app/page.tsx.
   */
  siteMode: "live" | "maintenance" | "ended";
  /** Optional custom text for the notice; falls back to a default per mode. */
  siteClosedMessage: string | null;
  /**
   * Which self-hosted `next/font/google` family drives `--font-script`
   * (the couple's short/full names, the venue name, the hashtag). See
   * `src/app/layout.tsx` (loads all five, sets `data-script-font` on
   * `<html>`) and `src/lib/wedding-config.ts`'s `SCRIPT_FONT_KEYS`.
   */
  scriptFont: "parisienne" | "greatVibes" | "dancingScript" | "sacramento" | "cormorantGaramond";
  /**
   * Google Analytics 4 Measurement ID (e.g. "G-XXXXXXXXXX"), or `null` to
   * disable GA entirely. When set, `<GoogleAnalytics>` is rendered ONLY on
   * the public invite page (never under `/admin`) — see `src/app/page.tsx`
   * and the README's "Analytics" section.
   */
  gaMeasurementId: string | null;
  eventType: string;
  groom: { shortName: string; fullName: string };
  bride: { shortName: string; fullName: string };
  hosts: { line: string; names: string };
  salam: string;
  invitationBody: string[];
  honorifics: string;
  /** ISO 8601 datetime of the akad/main ceremony, with the +08:00 Malaysia offset. */
  date: string;
  /** Malay day name, e.g. "Ahad" */
  dayNameMs: string;
  /** Human-readable date, e.g. "01 November 2026" */
  displayDate: string;
  /** ISO 8601 datetime the event ends — used to build the calendar (.ics) entry. */
  endTime: string;
  venue: {
    name: string;
    addressLines: string[];
    lat: number;
    lng: number;
    googleMapsUrl: string;
    wazeUrl: string;
  };
  aturCara: { time: string; label: string }[];
  rsvpDeadline: string;
  rsvpDeadlineDisplay: string;
  contacts: { name: string; role: string; phone: string }[];
  hashtag: string;
  gallery: { src: string; alt: string }[];
  doa: string;
};

export const wedding = {
  // Replace with the real domain once it is attached in Cloudflare.
  siteUrl: "https://wedding-card-arif.workers.dev",

  // Set to "/music/preset-1.mp3" once you add the file. See README.
  presetMusicPath: null,

  rsvpPaxMode: "adultsChildren",

  siteMode: "live",
  siteClosedMessage: null,

  scriptFont: "parisienne",

  // Set to a real "G-XXXXXXXXXX" Measurement ID to enable Google Analytics
  // on the public invite page. See README.
  gaMeasurementId: null,

  eventType: "WALIMATUL URUS",

  groom: {
    shortName: "Arif",
    fullName: "Muhammad Arif bin Abdullah",
  },
  bride: {
    shortName: "Nur Aisyah",
    fullName: "Nur Aisyah binti Ahmad",
  },

  hosts: {
    line: "Dengan penuh kesyukuran ke hadrat Ilahi, kami",
    names: "Encik Abdullah bin Hassan & Puan Zainab binti Omar\ndan\nEncik Ahmad bin Ismail & Puan Fatimah binti Kassim",
  },

  salam: "Assalamualaikum warahmatullahi wabarakatuh & salam sejahtera,",

  invitationBody: [
    "Dengan segala hormatnya kami menjemput Dato' / Datin / Tuan / Puan / Encik / Cik ke majlis perkahwinan anakanda kami.",
    "Kehadiran serta doa restu tuan/puan amatlah kami hargai dan dinantikan.",
  ],

  honorifics: "Dato' | Datin | Tuan | Puan | Encik | Cik",

  date: "2026-11-01T11:00:00+08:00",
  dayNameMs: "Ahad",
  displayDate: "01 November 2026",

  endTime: "2026-11-01T16:00:00+08:00",

  venue: {
    name: "Dewan Serbaguna Taman Seri Indah",
    addressLines: [
      "Jalan Seri Indah 5,",
      "Taman Seri Indah,",
      "43000 Kajang, Selangor",
    ],
    lat: 2.9926,
    lng: 101.7876,
    googleMapsUrl: "https://maps.google.com/?q=2.9926,101.7876",
    wazeUrl: "https://waze.com/ul?ll=2.9926,101.7876&navigate=yes",
  },

  aturCara: [
    { time: "11:00 AM", label: "Ketibaan tetamu" },
    { time: "12:00 PM", label: "Majlis makan beradab" },
    { time: "2:00 PM", label: "Sesi bergambar bersama pengantin" },
    { time: "4:00 PM", label: "Majlis bersurai" },
  ],

  rsvpDeadline: "2026-10-15T23:59:59+08:00",
  rsvpDeadlineDisplay: "15 Oktober 2026",

  contacts: [
    { name: "Ahmad bin Ismail", role: "Bapa Pengantin Lelaki", phone: "+60123456789" },
    { name: "Fatimah binti Kassim", role: "Ibu Pengantin Perempuan", phone: "+60129876543" },
  ],

  hashtag: "#PlaceholderHashtag",

  // Placeholder botanical abstractions until real photos are supplied — see
  // public/images/gallery/*.svg. Replace src with real photos (any raster
  // format) when available; nothing else needs to change.
  gallery: [
    { src: "/images/gallery/1.svg", alt: "Gambar pertunangan pasangan pengantin" },
    { src: "/images/gallery/2.svg", alt: "Gambar pasangan pengantin bersama keluarga" },
    { src: "/images/gallery/3.svg", alt: "Gambar pasangan pengantin di taman" },
  ],

  doa: "Ya Allah, jadikanlah pasangan ini pasangan yang saling mencintai, penuh kasih sayang, serta diberkati zuriat yang soleh dan solehah. Aamiin.",
} as const satisfies WeddingConfig;
