"use client";

import type { FormEvent } from "react";
import { useId, useRef, useState } from "react";

import {
  MAX_ADULTS,
  MAX_CHILDREN,
  MAX_WISH_MESSAGE_LEN,
  MIN_ADULTS,
  MIN_CHILDREN,
  rsvpSchema,
} from "@/lib/validation";
import { trackEvent } from "@/lib/track";

import { submitPublicForm } from "./submitPublicForm";

type Status = "idle" | "submitting" | "success" | "error";

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  id,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  id: string;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-brown-deep" id={`${id}-label`}>
        {label}
      </span>
      <div className="flex items-center gap-3" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Kurangkan ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-goldenrod text-lg text-brown-deep disabled:opacity-40"
        >
          −
        </button>
        <span className="w-8 text-center font-serif text-lg tabular-nums text-brown-deep" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Tambahkan ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-goldenrod text-lg text-brown-deep disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 10.5 8 14.5 16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5 15 15M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function RsvpForm({
  onSuccess,
  allowUcapan = true,
}: {
  onSuccess?: (result: { attending: boolean; adults: number; children: number }) => void;
  /** False when the admin has closed the ucapan section; the field is then hidden and never sent. */
  allowUcapan?: boolean;
}) {
  const [attending, setAttending] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [ucapan, setUcapan] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Measured against one clock (this device's) and sent as a duration, so a
  // skewed phone clock can never make the server treat a real guest as a bot.
  const mountedAtRef = useRef(Date.now());
  const nameId = useId();
  const phoneId = useId();
  const ucapanId = useId();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (attending === null) {
      setFormError("Sila pilih kehadiran anda.");
      return;
    }

    const candidate = {
      name,
      phone,
      attending,
      adults,
      children,
      ucapan: allowUcapan && ucapan.trim().length > 0 ? ucapan : undefined,
      website,
    };

    const result = rsvpSchema.safeParse(candidate);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0] ?? "",
        phone: flat.phone?.[0] ?? "",
        ucapan: flat.ucapan?.[0] ?? "",
      });
      setFormError("Sila semak semula maklumat yang dimasukkan.");
      return;
    }

    setFieldErrors({});
    setStatus("submitting");

    const outcome = await submitPublicForm("/api/rsvp", {
      ...result.data,
      elapsedMs: Date.now() - mountedAtRef.current,
    });

    if (outcome.ok) {
      setStatus("success");
      trackEvent("rsvp_submit");
      onSuccess?.({ attending, adults, children });
    } else {
      setStatus("error");
      setFormError("Maaf, penghantaran gagal. Sila cuba sebentar lagi.");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-2xl bg-sand px-4 py-6 text-center font-serif text-lg text-brown-deep">
        Terima kasih! RSVP anda telah diterima.
      </p>
    );
  }

  // STEP 1 — attendance only.
  //
  // The form is deliberately not shown until the guest has chosen. A wall
  // of fields is a lot to land on; two large buttons is one easy decision,
  // and it also means someone who can't attend never sees the pax steppers
  // at all. `attending` doubles as the step marker — there is no separate
  // step state to fall out of sync with it.
  if (attending === null) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-center text-sm text-brown">Sudikah tuan/puan hadir?</p>
        <div role="group" aria-label="Kehadiran" className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAttending(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-gold-light bg-sand px-4 py-5 text-sm font-medium text-brown-deep transition-colors hover:border-goldenrod hover:bg-tan"
          >
            <CheckIcon />
            Hadir
          </button>
          <button
            type="button"
            onClick={() => setAttending(false)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-gold-light bg-sand px-4 py-5 text-sm font-medium text-brown-deep transition-colors hover:border-goldenrod hover:bg-tan"
          >
            <CrossIcon />
            Tidak Hadir
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* The choice is already made; show it compactly with a way back
          rather than repeating the two big buttons above the fields. */}
      <div className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-brown-deep">
          {attending ? <CheckIcon /> : <CrossIcon />}
          {attending ? "Hadir" : "Tidak Hadir"}
        </span>
        <button
          type="button"
          onClick={() => setAttending(null)}
          className="text-xs font-medium text-brown underline underline-offset-4"
        >
          Tukar
        </button>
      </div>

      <div>
        <label htmlFor={nameId} className="mb-1 block text-sm font-medium text-brown-deep">
          Nama Anda
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
          aria-invalid={Boolean(fieldErrors.name)}
          className="w-full rounded-xl border border-gold-light bg-cream px-4 py-2.5 text-brown-deep"
        />
        {fieldErrors.name && (
          <p id={`${nameId}-error`} role="alert" className="mt-1 text-xs text-red-700">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={phoneId} className="mb-1 block text-sm font-medium text-brown-deep">
          Nombor Telefon
        </label>
        <input
          id={phoneId}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-describedby={fieldErrors.phone ? `${phoneId}-error` : undefined}
          aria-invalid={Boolean(fieldErrors.phone)}
          className="w-full rounded-xl border border-gold-light bg-cream px-4 py-2.5 text-brown-deep"
        />
        {fieldErrors.phone && (
          <p id={`${phoneId}-error`} role="alert" className="mt-1 text-xs text-red-700">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      {attending !== false && (
        <div className="grid grid-cols-2 gap-4">
          <Stepper
            id="adults"
            label="Jumlah Dewasa"
            value={adults}
            min={MIN_ADULTS}
            max={MAX_ADULTS}
            onChange={setAdults}
          />
          <Stepper
            id="children"
            label="Jumlah Kanak-kanak"
            value={children}
            min={MIN_CHILDREN}
            max={MAX_CHILDREN}
            onChange={setChildren}
          />
        </div>
      )}

      {/*
        The one free-text field on this form, and it is PUBLIC (after
        moderation). There used to be a private "Pesanan kepada keluarga"
        box beside it; having two message fields with opposite visibility
        was a trap — a guest could easily put something private on a public
        wall. One field, one meaning.

        Offered on both the Hadir and Tidak Hadir paths: the guests who
        can't attend are often the ones who most want to send something.
      */}
      {allowUcapan && (
        <div>
          <label htmlFor={ucapanId} className="mb-1 block text-sm font-medium text-brown-deep">
            Ucapan{" "}
            <span className="font-normal text-brown/70">
              (pilihan &middot; akan dipaparkan di kad setelah disemak)
            </span>
          </label>
          <textarea
            id={ucapanId}
            value={ucapan}
            onChange={(e) => setUcapan(e.target.value.slice(0, MAX_WISH_MESSAGE_LEN))}
            rows={4}
            maxLength={MAX_WISH_MESSAGE_LEN}
            aria-describedby={fieldErrors.ucapan ? `${ucapanId}-error` : `${ucapanId}-count`}
            aria-invalid={Boolean(fieldErrors.ucapan)}
            className="w-full rounded-xl border border-gold-light bg-cream px-4 py-2.5 text-brown-deep"
          />
          {fieldErrors.ucapan ? (
            <p id={`${ucapanId}-error`} role="alert" className="mt-1 text-xs text-red-700">
              {fieldErrors.ucapan}
            </p>
          ) : (
            <p id={`${ucapanId}-count`} className="mt-1 text-right text-xs text-brown/70">
              {ucapan.length}/{MAX_WISH_MESSAGE_LEN}
            </p>
          )}
        </div>
      )}

      {/* Honeypot: real visitors never see or reach this field. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hp-field"
      />

      {formError && (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-goldenrod bg-tan px-6 py-3 text-sm font-medium text-brown-deep disabled:opacity-60"
      >
        {status === "submitting" ? "Menghantar…" : "Hantar RSVP"}
      </button>
    </form>
  );
}
