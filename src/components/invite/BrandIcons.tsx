/**
 * Brand marks for the outbound links: Google Maps, Waze and WhatsApp.
 *
 * Inline SVG rather than image files. The CSP restricts `img-src` to
 * `'self' data: blob:`, so hotlinking the official assets from Google's or
 * Meta's CDN would simply be blocked — and shipping copies as static files
 * would mean three more requests for three tiny glyphs.
 *
 * These are trademarks, used here to label links that go to those services
 * — the ordinary "this button opens WhatsApp" use. They are hand-drawn
 * approximations in each brand's own colours, close enough to be
 * recognised at 18px. If exact fidelity ever matters, all three companies
 * publish official SVG assets under their brand guidelines; drop them in
 * `public/` and swap the components out.
 *
 * Each is `aria-hidden` — the adjacent text label is what a screen reader
 * announces, so repeating "WhatsApp" as an icon title would just stutter.
 */

type IconProps = { className?: string; size?: number };

/** Google Maps — the pin, in Google's four brand colours. */
export function GoogleMapsIcon({ className = "", size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Pin body: blue upper-left, red lower point, with the green and
          yellow accents the 2020 mark uses. */}
      <path d="M12 2a7 7 0 0 0-6.1 10.4l6.1 9.4 6.1-9.4A7 7 0 0 0 12 2Z" fill="#EA4335" />
      <path d="M5.9 12.4A7 7 0 0 1 12 2v9.5L5.9 12.4Z" fill="#4285F4" />
      <path d="M12 2a7 7 0 0 1 6.1 10.4L12 11.5V2Z" fill="#FBBC04" />
      <path d="m6.5 13.4 5.5 8.4 2.6-4-3.1-4.9-5 .5Z" fill="#34A853" />
      <circle cx="12" cy="9" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}

/** Waze — the speech-bubble face, in Waze cyan. */
export function WazeIcon({ className = "", size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M12 3c4.7 0 8.2 3 8.2 6.9 0 3.6-2.9 6.5-7 6.9-.7 1.4-2.2 2.4-3.9 2.4a4.3 4.3 0 0 1-3-1.2 4.3 4.3 0 0 1-3-1.3 1 1 0 0 1 .6-1.7c.7-.1 1.2-.6 1.3-1.3A6.4 6.4 0 0 1 3.8 9.9C3.8 6 7.3 3 12 3Z"
        fill="#33CCFF"
      />
      <circle cx="9.4" cy="9.2" r="1.15" fill="#FFFFFF" />
      <circle cx="14.6" cy="9.2" r="1.15" fill="#FFFFFF" />
      <path
        d="M9 12.2a3.4 3.4 0 0 0 6 0"
        stroke="#FFFFFF"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** WhatsApp — the handset in a speech bubble, in WhatsApp green. */
export function WhatsAppIcon({ className = "", size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2Z"
        fill="#25D366"
      />
      <path
        d="M9.1 7.3c-.2-.5-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.35c-.25.27-.95.93-.95 2.26 0 1.33.97 2.62 1.1 2.8.14.18 1.88 3 4.62 4.09 2.28.9 2.74.72 3.24.67.5-.04 1.6-.65 1.83-1.29.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.31-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.13-.6.14-.19.27-.7.88-.86 1.06-.16.18-.32.2-.59.07a7.4 7.4 0 0 1-2.17-1.34 8.2 8.2 0 0 1-1.5-1.87c-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.14-.16.18-.27.28-.45.09-.18.04-.34-.02-.48-.07-.13-.6-1.44-.82-1.97Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** A plain handset for the "Telefon" link — not a brand mark. */
export function PhoneIcon({ className = "", size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M6.6 3h2.2l1.6 4-1.9 1.2a12 12 0 0 0 5.3 5.3l1.2-1.9 4 1.6v2.2A2.6 2.6 0 0 1 16.4 18 13.4 13.4 0 0 1 6 7.6 2.6 2.6 0 0 1 6.6 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Google Calendar — the white sheet with the four-colour edge and a date. */
export function GoogleCalendarIcon({ className = "", size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#FFFFFF" />
      <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H9v4H3V5.5Z" fill="#4285F4" />
      <path d="M15 3h3.5A2.5 2.5 0 0 1 21 5.5V9h-6V3Z" fill="#EA4335" />
      <path d="M3 15h6v6H5.5A2.5 2.5 0 0 1 3 18.5V15Z" fill="#34A853" />
      <path d="M15 15h6v3.5a2.5 2.5 0 0 1-2.5 2.5H15v-6Z" fill="#FBBC04" />
      <text
        x="12"
        y="15.4"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#4285F4"
      >
        31
      </text>
    </svg>
  );
}

/** Apple Calendar — the torn-off sheet with a red day header. */
export function AppleCalendarIcon({ className = "", size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="3.5" fill="#FFFFFF" stroke="#D8D8D8" strokeWidth="0.8" />
      <path d="M3 6.5A3.5 3.5 0 0 1 6.5 3h11A3.5 3.5 0 0 1 21 6.5V8H3V6.5Z" fill="#FF3B30" />
      <text
        x="12"
        y="17.6"
        textAnchor="middle"
        fontSize="9"
        fontWeight="500"
        fontFamily="Helvetica, Arial, sans-serif"
        fill="#1C1C1E"
      >
        31
      </text>
    </svg>
  );
}
