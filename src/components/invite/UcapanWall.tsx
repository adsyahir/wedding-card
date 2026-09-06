"use client";

import { useState } from "react";

import { Reveal } from "./Reveal";

export type PublicWish = {
  name: string;
  message: string;
  createdAt: string;
};

const VISIBLE_CAP = 30;

export function UcapanWall({ wishes }: { wishes: PublicWish[] }) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? wishes : wishes.slice(0, VISIBLE_CAP);
  const hasMore = wishes.length > VISIBLE_CAP && !expanded;

  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Ucapan
      </Reveal>

      {wishes.length === 0 ? (
        <Reveal delay={0.1} className="mx-auto mt-8 max-w-sm text-brown">
          <p>Jadilah yang pertama menyampaikan ucapan.</p>
        </Reveal>
      ) : (
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-6">
          {visible.map((wish, index) => (
            <Reveal
              key={`${wish.name}-${wish.createdAt}-${index}`}
              delay={Math.min(index * 0.04, 0.3)}
              className="rounded-2xl bg-sand px-5 py-4 text-left"
            >
              <p className="font-serif text-lg leading-7 text-brown-deep italic">
                &ldquo;{wish.message}&rdquo;
              </p>
              <p className="mt-3 text-xs font-medium tracking-[0.15em] text-brown uppercase">
                {wish.name}
              </p>
            </Reveal>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-8 inline-flex items-center justify-center rounded-full border border-goldenrod px-6 py-2.5 text-sm font-medium text-brown-deep transition-transform hover:scale-[1.02]"
        >
          Lihat lagi
        </button>
      )}
    </section>
  );
}
