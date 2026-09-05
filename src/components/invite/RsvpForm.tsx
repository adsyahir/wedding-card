"use client";

import type { FormEvent } from "react";
import { useId, useRef, useState } from "react";

import {
  MAX_ADULTS,
  MAX_CHILDREN,
  MAX_RSVP_MESSAGE_LEN,
  MIN_ADULTS,
  MIN_CHILDREN,
  rsvpSchema,
} from "@/lib/validation";

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

export function RsvpForm({
  onSuccess,
}: {
  onSuccess?: (result: { attending: boolean; adults: number; children: number }) => void;
}) {
  const [attending, setAttending] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const renderedAtRef = useRef(new Date().toISOString());
  const nameId = useId();
  const phoneId = useId();
  const messageId = useId();

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
      message: message.trim().length > 0 ? message : undefined,
      website,
    };

    const result = rsvpSchema.safeParse(candidate);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0] ?? "",
        phone: flat.phone?.[0] ?? "",
        message: flat.message?.[0] ?? "",
      });
      setFormError("Sila semak semula maklumat yang dimasukkan.");
      return;
    }

    setFieldErrors({});
    setStatus("submitting");

    const outcome = await submitPublicForm("/api/rsvp", {
      ...result.data,
      renderedAt: renderedAtRef.current,
    });

    if (outcome.ok) {
      setStatus("success");
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

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Kehadiran" className="grid grid-cols-2 gap-3">
        {(
          [
            { value: true, label: "Hadir" },
            { value: false, label: "Tidak Hadir" },
          ] as const
        ).map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={attending === option.value}
            onClick={() => setAttending(option.value)}
            className={`rounded-2xl border px-4 py-4 text-sm font-medium transition-colors ${
              attending === option.value
                ? "border-goldenrod bg-tan text-brown-deep"
                : "border-gold-light bg-sand text-brown-deep"
            }`}
          >
            {option.label}
          </button>
        ))}
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

      <div>
        <label htmlFor={messageId} className="mb-1 block text-sm font-medium text-brown-deep">
          Pesanan <span className="font-normal text-brown/70">(pilihan)</span>
        </label>
        <textarea
          id={messageId}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_RSVP_MESSAGE_LEN))}
          rows={3}
          maxLength={MAX_RSVP_MESSAGE_LEN}
          aria-describedby={`${messageId}-count`}
          className="w-full rounded-xl border border-gold-light bg-cream px-4 py-2.5 text-brown-deep"
        />
        <p id={`${messageId}-count`} className="mt-1 text-right text-xs text-brown/70">
          {message.length}/{MAX_RSVP_MESSAGE_LEN}
        </p>
      </div>

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
