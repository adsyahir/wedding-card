"use client";

import { useRef, useState } from "react";

import type { wedding } from "@/config/wedding";

import { AturCara } from "./AturCara";
import { BottomNav } from "./BottomNav";
import type { NavKey } from "./BottomNav";
import { Countdown } from "./Countdown";
import { Envelope } from "./Envelope";
import { Footer } from "./Footer";
import { Galeri } from "./Galeri";
import { Hero } from "./Hero";
import { HubungiSheet } from "./HubungiSheet";
import { KalendarSheet } from "./KalendarSheet";
import { Kehadiran } from "./Kehadiran";
import { Lokasi } from "./Lokasi";
import { LokasiSheet } from "./LokasiSheet";
import { MusicPlayer } from "./MusicPlayer";
import { RsvpSheet } from "./RsvpSheet";
import { Sheet } from "./Sheet";
import { Undangan } from "./Undangan";
import { UcapanWall } from "./UcapanWall";
import type { PublicWish } from "./UcapanWall";

const SHEET_TITLES: Record<NavKey, string> = {
  kalendar: "Kalendar",
  lokasi: "Lokasi",
  hubungi: "Hubungi",
  rsvp: "RSVP",
};

export function InviteApp({
  config,
  wishes,
  initialCounts,
  musicSrc,
}: {
  config: typeof wedding;
  wishes: PublicWish[];
  initialCounts: { hadir: number; tidakHadir: number };
  musicSrc: string | null;
}) {
  const [musicShouldPlay, setMusicShouldPlay] = useState(false);
  const [activeSheet, setActiveSheet] = useState<NavKey | null>(null);
  const [counts, setCounts] = useState(initialCounts);
  const triggerRefs = useRef<Record<NavKey, HTMLButtonElement | null>>({
    kalendar: null,
    lokasi: null,
    hubungi: null,
    rsvp: null,
  });
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  function handleSelect(key: NavKey) {
    activeTriggerRef.current = triggerRefs.current[key];
    setActiveSheet(key);
  }

  function handleRsvpSuccess({ attending }: { attending: boolean }) {
    setCounts((prev) =>
      attending
        ? { ...prev, hadir: prev.hadir + 1 }
        : { ...prev, tidakHadir: prev.tidakHadir + 1 },
    );
  }

  return (
    <>
      <Envelope
        groomShortName={config.groom.shortName}
        brideShortName={config.bride.shortName}
        onOpen={() => setMusicShouldPlay(true)}
      />

      <MusicPlayer src={musicSrc} play={musicShouldPlay} />

      <div className="mx-auto flex w-full max-w-[480px] flex-col bg-cream pb-24 shadow-xl shadow-brown-deep/5">
        <Hero config={config} />
        <Undangan config={config} />
        <Lokasi config={config} />
        <AturCara config={config} />
        <Countdown targetIso={config.date} />
        <Galeri gallery={config.gallery} />
        <UcapanWall wishes={wishes} />
        <Kehadiran hadir={counts.hadir} tidakHadir={counts.tidakHadir} />
        <Footer config={config} />
      </div>

      <BottomNav
        onSelect={handleSelect}
        registerTriggerRef={(key, el) => {
          triggerRefs.current[key] = el;
        }}
      />

      <Sheet
        open={activeSheet !== null}
        onClose={() => setActiveSheet(null)}
        title={activeSheet ? SHEET_TITLES[activeSheet] : ""}
        triggerRef={activeTriggerRef}
      >
        {activeSheet === "kalendar" && <KalendarSheet config={config} />}
        {activeSheet === "lokasi" && <LokasiSheet config={config} />}
        {activeSheet === "hubungi" && <HubungiSheet config={config} />}
        {activeSheet === "rsvp" && <RsvpSheet onRsvpSuccess={handleRsvpSuccess} />}
      </Sheet>
    </>
  );
}
