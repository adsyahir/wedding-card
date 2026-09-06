"use client";

import { useEffect, useState } from "react";

import { Reveal } from "./Reveal";

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  passed: boolean;
};

function computeRemaining(targetIso: string): Remaining {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, passed: true };
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, passed: false };
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-sand px-3 py-4 sm:px-5">
      {/* `min-w-[2ch]` as well as tabular-nums: Cormorant has no tabular
          figure feature to switch on, so the numerals are proportional and
          "11" is narrower than "58" — the cell would breathe on every tick
          without a floor on its width. */}
      <span className="min-w-[2ch] font-serif text-3xl tabular-nums text-brown-deep sm:text-4xl">
        {value}
      </span>
      <span className="text-[11px] tracking-[0.15em] text-brown uppercase">{label}</span>
    </div>
  );
}

/** Accepts the target date as an ISO string prop (server + client render the same markup on first paint). */
export function Countdown({ targetIso }: { targetIso: string }) {
  // Start `null` (rendered as "--") so the server-rendered markup and the
  // client's very first render match exactly; the real value is computed in
  // an effect, which only ever runs on the client — no hydration mismatch.
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(computeRemaining(targetIso));
    const id = window.setInterval(() => {
      setRemaining(computeRemaining(targetIso));
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  const display = remaining ?? { days: 0, hours: 0, minutes: 0, seconds: 0, passed: false };
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Menghitung Hari
      </Reveal>

      {remaining?.passed ? (
        <Reveal delay={0.1} className="mt-8 font-serif text-xl text-brown-deep">
          <p>Majlis telah berlangsung. Terima kasih atas doa dan restu.</p>
        </Reveal>
      ) : (
        <Reveal delay={0.1} className="mx-auto mt-8 grid max-w-sm grid-cols-4 gap-2 sm:gap-4">
          <Cell value={remaining ? pad(display.days) : "--"} label="Hari" />
          <Cell value={remaining ? pad(display.hours) : "--"} label="Jam" />
          <Cell value={remaining ? pad(display.minutes) : "--"} label="Minit" />
          <Cell value={remaining ? pad(display.seconds) : "--"} label="Saat" />
        </Reveal>
      )}
    </section>
  );
}
