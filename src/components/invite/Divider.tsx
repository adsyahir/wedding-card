/** Small ornamental flourish reused between sections as a visual divider. */
export function Divider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 24"
      width="120"
      height="24"
      role="presentation"
      aria-hidden="true"
      className={`mx-auto text-goldenrod ${className}`}
    >
      <path
        d="M2 12 H44 M76 12 H118"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M60 12 C 56 4, 48 4, 46 10 C 48 6, 56 6, 60 12 C 64 6, 72 6, 74 10 C 72 4, 64 4, 60 12 Z"
        fill="currentColor"
      />
      <circle cx="60" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
