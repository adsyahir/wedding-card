/** Trash glyph for destructive buttons. `aria-hidden`: the button's own text labels it. */
export function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 7h16M10 4h4M9 7v11m3-11v11m3-11v11M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
