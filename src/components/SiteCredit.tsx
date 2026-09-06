/**
 * "Dibina oleh adsyahir.com" — the build credit, shown on both the public
 * invitation and the admin dashboard.
 *
 * Deliberately quiet: on the card it must not compete with the couple's
 * own hashtag directly above it, and on a wedding invitation a loud
 * builder credit is in poor taste. `rel="noopener noreferrer"` because it
 * opens in a new tab, and `nofollow` since this is a credit link rather
 * than an endorsement.
 */
export function SiteCredit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-brown/50 ${className}`}>
      Dibina oleh{" "}
      <a
        href="https://adsyahir.com/"
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 transition-colors hover:text-brown"
      >
        adsyahir.com
      </a>
    </p>
  );
}
