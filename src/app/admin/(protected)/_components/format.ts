/** Shared, forgiving date formatting for the admin dashboard's server components. */
export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ms-MY", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}
