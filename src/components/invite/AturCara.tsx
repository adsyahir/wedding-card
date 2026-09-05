import type { wedding } from "@/config/wedding";

import { Reveal } from "./Reveal";

export function AturCara({ config }: { config: typeof wedding }) {
  return (
    <section className="w-full px-6 py-16 text-center">
      <Reveal as="h2" className="font-serif text-2xl tracking-[0.25em] text-brown-deep uppercase">
        Atur Cara Majlis
      </Reveal>

      <ol className="mx-auto mt-10 flex max-w-sm flex-col gap-8 text-left">
        {config.aturCara.map((item, index) => (
          <Reveal key={item.label} delay={index * 0.08} as="li">
            <div className="relative flex gap-4 pl-6">
              <span
                aria-hidden="true"
                className="absolute top-1.5 left-0 h-2 w-2 rounded-full bg-goldenrod"
              />
              {index < config.aturCara.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-4 left-[3px] h-[calc(100%+2rem-1rem)] w-px bg-gold-light"
                />
              )}
              <div>
                <p className="font-serif text-lg font-medium text-brown-deep">{item.time}</p>
                <p className="mt-0.5 text-sm text-brown">{item.label}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
