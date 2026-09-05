export function StatCard({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        emphasize ? "border-goldenrod/60 bg-goldenrod/10" : "border-tan/30 bg-sand/40"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-brown/60">{label}</p>
      <p className="mt-1 font-serif text-3xl text-brown-deep">{value}</p>
    </div>
  );
}
