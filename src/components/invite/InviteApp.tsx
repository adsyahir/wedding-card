"use client";

import { useRef, useState } from "react";

import type { WeddingConfig } from "@/config/wedding";
import type { PublicGalleryItem } from "@/db/queries/public";
import type { SectionsConfig } from "@/lib/wedding-config";
import { trackEvent } from "@/lib/track";

import { AturCara } from "./AturCara";
import { BottomNav } from "./BottomNav";
import type { NavKey } from "./BottomNav";
import { Countdown } from "./Countdown";
import { Envelope } from "./Envelope";
import { Footer } from "./Footer";
import { Galeri } from "./Galeri";
import { Hero } from "./Hero";
import { Petals } from "./Petals";
import { HubungiSheet } from "./HubungiSheet";
import { KalendarSheet } from "./KalendarSheet";
import { Kehadiran } from "./Kehadiran";
import { Lokasi } from "./Lokasi";
import { LokasiSheet } from "./LokasiSheet";
import { MusicPlayer } from "./MusicPlayer";
import { RsvpSheet } from "./RsvpSheet";
import { Sheet } from "./Sheet";
import { TrackView } from "./TrackView";
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
  sections,
  wishes,
  initialCounts,
  musicSrc,
  gallery,
}: {
  config: WeddingConfig;
  sections: SectionsConfig;
  wishes: PublicWish[];
  initialCounts: { hadir: number; tidakHadir: number } | null;
  musicSrc: string | null;
  gallery: PublicGalleryItem[];
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

  // A hidden nav item's sheet must never be reachable, even if something
  // stale in state points at it (e.g. `navRsvp` toggled off elsewhere).
  const navEnabled: Record<NavKey, boolean> = {
    kalendar: sections.navKalendar,
    lokasi: sections.navLokasi,
    hubungi: sections.navHubungi,
    rsvp: sections.navRsvp,
  };

  function handleSelect(key: NavKey) {
    if (!navEnabled[key]) return;
    activeTriggerRef.current = triggerRefs.current[key];
    setActiveSheet(key);
    if (key === "rsvp") {
      trackEvent("rsvp_open");
    }
  }

  function handleRsvpSuccess({ attending }: { attending: boolean }) {
    setCounts((prev) =>
      prev === null
        ? prev
        : attending
          ? { ...prev, hadir: prev.hadir + 1 }
          : { ...prev, tidakHadir: prev.tidakHadir + 1 },
    );
  }

  const activeSheetReachable = activeSheet !== null && navEnabled[activeSheet];

  return (
    <>
      <TrackView />

      <Envelope
        groomShortName={config.groom.shortName}
        brideShortName={config.bride.shortName}
        onOpen={() => setMusicShouldPlay(true)}
      />

      <MusicPlayer src={musicSrc} play={musicShouldPlay} />

      <div className="invite-card relative mx-auto flex w-full max-w-[480px] flex-col pb-24">
        <Petals />
        <Hero config={config} />
        {sections.undangan && <Undangan config={config} />}
        {sections.lokasi && <Lokasi config={config} />}
        {sections.aturCara && <AturCara config={config} />}
        {sections.countdown && <Countdown targetIso={config.date} />}
        {sections.galeri && <Galeri gallery={gallery} />}
        {sections.ucapan && <UcapanWall wishes={wishes} />}
        {sections.kehadiran && counts !== null && (
          <Kehadiran hadir={counts.hadir} tidakHadir={counts.tidakHadir} />
        )}
        <Footer config={config} />
      </div>

      <BottomNav
        items={navEnabled}
        onSelect={handleSelect}
        registerTriggerRef={(key, el) => {
          triggerRefs.current[key] = el;
        }}
      />

      <Sheet
        open={activeSheetReachable}
        onClose={() => setActiveSheet(null)}
        title={activeSheet ? SHEET_TITLES[activeSheet] : ""}
        triggerRef={activeTriggerRef}
      >
        {activeSheet === "kalendar" && (
          <KalendarSheet config={config} showGrid={sections.kalendarGrid} />
        )}
        {activeSheet === "lokasi" && <LokasiSheet config={config} showMap={sections.petaEmbed} />}
        {activeSheet === "hubungi" && <HubungiSheet config={config} />}
        {activeSheet === "rsvp" && <RsvpSheet onRsvpSuccess={handleRsvpSuccess}  allowUcapan={sections.ucapan} paxMode={config.rsvpPaxMode}/>}
      </Sheet>
    </>
  );
}
