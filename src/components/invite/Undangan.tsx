import type { wedding } from "@/config/wedding";

import { Divider } from "./Divider";
import { Reveal } from "./Reveal";

export function Undangan({ config }: { config: typeof wedding }) {
  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Undangan
      </Reveal>

      <Reveal delay={0.1} className="mx-auto mt-8 max-w-md text-base leading-8 text-brown">
        <p>{config.salam}</p>
      </Reveal>

      <Reveal delay={0.15}>
        <Divider className="my-8" />
      </Reveal>

      <Reveal delay={0.2} className="mx-auto max-w-md text-base leading-8 text-brown">
        <p>{config.hosts.line}</p>
        <p className="mt-3 whitespace-pre-line font-serif text-lg text-brown-deep">
          {config.hosts.names}
        </p>
      </Reveal>

      <Reveal delay={0.25}>
        <Divider className="my-8" />
      </Reveal>

      <Reveal delay={0.3} className="mx-auto max-w-md text-sm text-brown">
        <p>{config.honorifics}</p>
      </Reveal>

      <Reveal delay={0.35} className="mx-auto mt-6 max-w-md space-y-4 text-base leading-8 text-brown">
        {config.invitationBody.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </Reveal>

      <Reveal delay={0.4}>
        <Divider className="my-8" />
      </Reveal>

      <Reveal delay={0.45} className="flex flex-col items-center gap-2">
        <p className="font-script text-3xl text-brown-deep">{config.groom.fullName}</p>
        <p className="text-goldenrod">&amp;</p>
        <p className="font-script text-3xl text-brown-deep">{config.bride.fullName}</p>
      </Reveal>

      <Reveal delay={0.5} className="mt-6 text-sm tracking-[0.1em] text-brown uppercase">
        <p>
          {config.dayNameMs}, {config.displayDate}
        </p>
      </Reveal>
    </section>
  );
}
