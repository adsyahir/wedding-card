"use client";

import { useState } from "react";

import { RsvpForm } from "./RsvpForm";
import { UcapanForm } from "./UcapanForm";

type Tab = "kehadiran" | "ucapan";

export function RsvpSheet({
  onRsvpSuccess,
}: {
  onRsvpSuccess?: (result: { attending: boolean; adults: number; children: number }) => void;
}) {
  const [tab, setTab] = useState<Tab>("kehadiran");

  return (
    <div>
      <div role="tablist" aria-label="RSVP" className="mb-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          role="tab"
          id="tab-kehadiran"
          aria-selected={tab === "kehadiran"}
          aria-controls="panel-kehadiran"
          onClick={() => setTab("kehadiran")}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            tab === "kehadiran"
              ? "border-goldenrod bg-tan text-brown-deep"
              : "border-gold-light bg-sand text-brown-deep"
          }`}
        >
          Kehadiran
        </button>
        <button
          type="button"
          role="tab"
          id="tab-ucapan"
          aria-selected={tab === "ucapan"}
          aria-controls="panel-ucapan"
          onClick={() => setTab("ucapan")}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            tab === "ucapan"
              ? "border-goldenrod bg-tan text-brown-deep"
              : "border-gold-light bg-sand text-brown-deep"
          }`}
        >
          Ucapan
        </button>
      </div>

      <div
        id="panel-kehadiran"
        role="tabpanel"
        aria-labelledby="tab-kehadiran"
        hidden={tab !== "kehadiran"}
      >
        {tab === "kehadiran" && <RsvpForm onSuccess={onRsvpSuccess} />}
      </div>
      <div id="panel-ucapan" role="tabpanel" aria-labelledby="tab-ucapan" hidden={tab !== "ucapan"}>
        {tab === "ucapan" && <UcapanForm />}
      </div>
    </div>
  );
}
