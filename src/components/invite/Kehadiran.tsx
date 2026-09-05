import { Reveal } from "./Reveal";

export function Kehadiran({ hadir, tidakHadir }: { hadir: number; tidakHadir: number }) {
  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Kehadiran
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-8 flex max-w-xs justify-center gap-6">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-sand px-4 py-6">
          <span className="font-serif text-4xl tabular-nums text-brown-deep">{hadir}</span>
          <span className="text-xs tracking-[0.15em] text-brown uppercase">Hadir</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-sand px-4 py-6">
          <span className="font-serif text-4xl tabular-nums text-brown-deep">{tidakHadir}</span>
          <span className="text-xs tracking-[0.15em] text-brown uppercase">Tidak Hadir</span>
        </div>
      </Reveal>
    </section>
  );
}
