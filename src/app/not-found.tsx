import Link from "next/link";

/**
 * App Router's global 404 — rendered for any path that doesn't match a
 * route (and by any `notFound()` call). A plain Server Component: there's
 * no error object here, nothing to withhold, just a graceful "page not
 * found" in the same visual language as the rest of the card.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-cream px-6 text-center">
      <p className="font-script text-4xl text-goldenrod">404</p>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-2xl text-brown-deep">Halaman tidak dijumpai.</h1>
        <p className="max-w-sm text-sm text-brown/70">
          Pautan yang tuan/puan ikuti mungkin salah atau sudah tidak wujud.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-goldenrod px-6 py-2.5 text-sm font-medium text-cream transition hover:bg-brown"
      >
        Kembali ke Jemputan
      </Link>
    </main>
  );
}
