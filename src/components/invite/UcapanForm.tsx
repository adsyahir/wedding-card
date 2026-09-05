"use client";

import type { FormEvent } from "react";
import { useId, useRef, useState } from "react";

import { MAX_WISH_MESSAGE_LEN, wishSchema } from "@/lib/validation";

import { submitPublicForm } from "./submitPublicForm";

type Status = "idle" | "submitting" | "success" | "error";

export function UcapanForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Measured against one clock (this device's) and sent as a duration, so a
  // skewed phone clock can never make the server treat a real guest as a bot.
  const mountedAtRef = useRef(Date.now());
  const nameId = useId();
  const messageId = useId();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const candidate = { name, message, website };
    const result = wishSchema.safeParse(candidate);

    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0] ?? "",
        message: flat.message?.[0] ?? "",
      });
      setFormError("Sila semak semula maklumat yang dimasukkan.");
      return;
    }

    setFieldErrors({});
    setStatus("submitting");

    const outcome = await submitPublicForm("/api/wishes", {
      ...result.data,
      elapsedMs: Date.now() - mountedAtRef.current,
    });

    if (outcome.ok) {
      setStatus("success");
    } else {
      setStatus("error");
      setFormError("Maaf, penghantaran gagal. Sila cuba sebentar lagi.");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-2xl bg-sand px-4 py-6 text-center font-serif text-lg text-brown-deep">
        Terima kasih! Ucapan anda akan dipaparkan setelah disemak.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
        <label htmlFor={messageId} className="mb-1 block text-sm font-medium text-brown-deep">
          Ucapan
        </label>
        <textarea
          id={messageId}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_WISH_MESSAGE_LEN))}
          rows={4}
          maxLength={MAX_WISH_MESSAGE_LEN}
          aria-describedby={
            fieldErrors.message ? `${messageId}-error ${messageId}-count` : `${messageId}-count`
          }
          aria-invalid={Boolean(fieldErrors.message)}
          className="w-full rounded-xl border border-gold-light bg-cream px-4 py-2.5 text-brown-deep"
        />
        <p id={`${messageId}-count`} className="mt-1 text-right text-xs text-brown/70">
          {message.length}/{MAX_WISH_MESSAGE_LEN}
        </p>
        {fieldErrors.message && (
          <p id={`${messageId}-error`} role="alert" className="mt-1 text-xs text-red-700">
            {fieldErrors.message}
          </p>
        )}
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
        {status === "submitting" ? "Menghantar…" : "Hantar Ucapan"}
      </button>
    </form>
  );
}
