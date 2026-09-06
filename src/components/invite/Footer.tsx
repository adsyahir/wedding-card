import type { WeddingConfig } from "@/config/wedding";

import { Reveal } from "./Reveal";

export function Footer({ config }: { config: WeddingConfig }) {
  return (
    <footer className="w-full px-6 pt-12 pb-32 text-center">
      <Reveal className="font-script text-3xl text-brown-deep">{config.hashtag}</Reveal>
      <Reveal delay={0.1} className="mx-auto mt-4 max-w-xs text-sm text-brown">
        <p>Sila RSVP kehadiran anda sebelum {config.rsvpDeadlineDisplay}.</p>
      </Reveal>
    </footer>
  );
}
