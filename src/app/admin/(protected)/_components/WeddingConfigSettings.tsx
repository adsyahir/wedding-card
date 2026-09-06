"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { WeddingConfig } from "@/config/wedding";
import type { SectionsConfig } from "@/lib/wedding-config";
import { csrfHeaders } from "@/lib/csrf-client";

type ApiResponse = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const TABS = ["butiran", "lokasi", "aturcara", "hubungi", "bahagian"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  butiran: "Butiran",
  lokasi: "Lokasi",
  aturcara: "Atur Cara",
  hubungi: "Hubungi",
  bahagian: "Bahagian",
};

/**
 * Posts one slice of the wedding config JSON doc to
 * `POST /api/admin/settings/wedding` (see `src/lib/wedding-config.ts` for
 * the merge-on-save semantics: each tab only ever sends the fields it
 * owns). Returns per-field Malay error messages on validation failure.
 */
async function saveSlice(slice: unknown): Promise<{ ok: true } | { ok: false; error: string; fieldErrors: Record<string, string> }> {
  try {
    const response = await fetch("/api/admin/settings/wedding", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify(slice),
    });
    const data = (await response.json().catch(() => null)) as ApiResponse | null;
    if (!response.ok || !data?.ok) {
      return {
        ok: false,
        error: (data && !data.ok && data.error) || "Ralat tidak dijangka. Sila cuba lagi.",
        fieldErrors: (data && !data.ok && data.fieldErrors) || {},
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Ralat rangkaian. Sila cuba lagi.", fieldErrors: {} };
  }
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-brown-deep">
      <span className="font-medium">{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

const inputClass =
  "rounded-md border border-tan/40 bg-cream px-3 py-1.5 text-sm text-brown-deep";

function SaveBar({
  pending,
  error,
  success,
  onSave,
}: {
  pending: boolean;
  error: string | null;
  success: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-tan/30 pt-4">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="rounded-md bg-goldenrod px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-brown disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Simpan"}
      </button>
      {success && <span className="text-xs text-green-700">Berjaya disimpan.</span>}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

function useSectionSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function save(slice: unknown) {
    setPending(true);
    setError(null);
    setSuccess(false);
    setFieldErrors({});
    const result = await saveSlice(slice);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors);
      return false;
    }
    setSuccess(true);
    router.refresh();
    return true;
  }

  return { save, pending, error, success, fieldErrors };
}

export function WeddingConfigSettings({
  initialConfig,
  isOverridden,
}: {
  initialConfig: WeddingConfig & { sections: SectionsConfig };
  isOverridden: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("butiran");
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleReset() {
    if (
      !window.confirm(
        "Kembalikan semua tetapan kad jemputan kepada nilai asal fail (src/config/wedding.ts)? Tindakan ini tidak boleh dibatalkan.",
      )
    ) {
      return;
    }
    setResetPending(true);
    setResetError(null);
    try {
      const response = await fetch("/api/admin/settings/wedding/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: "{}",
      });
      const data = (await response.json().catch(() => null)) as ApiResponse | null;
      if (!response.ok || !data?.ok) {
        setResetError((data && !data.ok && data.error) || "Ralat tidak dijangka. Sila cuba lagi.");
        return;
      }
      router.refresh();
    } catch {
      setResetError("Ralat rangkaian. Sila cuba lagi.");
    } finally {
      setResetPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-tan/30 bg-sand/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl text-brown-deep">Kandungan Kad Jemputan</h2>
        <div className="flex items-center gap-2">
          {isOverridden && (
            <span className="rounded-full bg-tan/40 px-2 py-0.5 text-xs text-brown-deep">
              Menggunakan tetapan admin
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            disabled={resetPending}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-40"
          >
            {resetPending ? "Memulihkan..." : "Kembalikan ke asal"}
          </button>
        </div>
      </div>
      {resetError && (
        <p role="alert" className="text-xs text-red-700">
          {resetError}
        </p>
      )}

      <div role="tablist" aria-label="Tetapan kad jemputan" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              tab === t
                ? "border-goldenrod bg-tan text-brown-deep"
                : "border-tan/40 bg-cream text-brown-deep"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "butiran" && <ButiranTab initialConfig={initialConfig} />}
      {tab === "lokasi" && <LokasiTab initialConfig={initialConfig} />}
      {tab === "aturcara" && <AturCaraTab initialConfig={initialConfig} />}
      {tab === "hubungi" && <HubungiTab initialConfig={initialConfig} />}
      {tab === "bahagian" && <BahagianTab initialConfig={initialConfig} />}
    </section>
  );
}

function ButiranTab({ initialConfig }: { initialConfig: WeddingConfig }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave();
  const [eventType, setEventType] = useState(initialConfig.eventType);
  const [groomShort, setGroomShort] = useState(initialConfig.groom.shortName);
  const [groomFull, setGroomFull] = useState(initialConfig.groom.fullName);
  const [brideShort, setBrideShort] = useState(initialConfig.bride.shortName);
  const [brideFull, setBrideFull] = useState(initialConfig.bride.fullName);
  const [hostsLine, setHostsLine] = useState(initialConfig.hosts.line);
  const [hostsNames, setHostsNames] = useState(initialConfig.hosts.names);
  const [salam, setSalam] = useState(initialConfig.salam);
  const [honorifics, setHonorifics] = useState(initialConfig.honorifics);
  const [invitationBody, setInvitationBody] = useState(initialConfig.invitationBody.join("\n\n"));
  const [date, setDate] = useState(initialConfig.date);
  const [dayNameMs, setDayNameMs] = useState(initialConfig.dayNameMs);
  const [displayDate, setDisplayDate] = useState(initialConfig.displayDate);
  const [endTime, setEndTime] = useState(initialConfig.endTime);
  const [rsvpDeadline, setRsvpDeadline] = useState(initialConfig.rsvpDeadline);
  const [rsvpDeadlineDisplay, setRsvpDeadlineDisplay] = useState(initialConfig.rsvpDeadlineDisplay);
  const [hashtag, setHashtag] = useState(initialConfig.hashtag);
  const [doa, setDoa] = useState(initialConfig.doa);

  function handleSave() {
    void save({
      eventType,
      groom: { shortName: groomShort, fullName: groomFull },
      bride: { shortName: brideShort, fullName: brideFull },
      hosts: { line: hostsLine, names: hostsNames },
      salam,
      honorifics,
      invitationBody: invitationBody
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      date,
      dayNameMs,
      displayDate,
      endTime,
      rsvpDeadline,
      rsvpDeadlineDisplay,
      hashtag,
      doa,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Jenis Majlis" error={fieldErrors.eventType}>
          <input className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)} />
        </Field>
        <Field label="Hashtag" error={fieldErrors.hashtag}>
          <input className={inputClass} value={hashtag} onChange={(e) => setHashtag(e.target.value)} />
        </Field>
        <Field label="Nama Pendek Pengantin Lelaki" error={fieldErrors["groom.shortName"]}>
          <input className={inputClass} value={groomShort} onChange={(e) => setGroomShort(e.target.value)} />
        </Field>
        <Field label="Nama Penuh Pengantin Lelaki" error={fieldErrors["groom.fullName"]}>
          <input className={inputClass} value={groomFull} onChange={(e) => setGroomFull(e.target.value)} />
        </Field>
        <Field label="Nama Pendek Pengantin Perempuan" error={fieldErrors["bride.shortName"]}>
          <input className={inputClass} value={brideShort} onChange={(e) => setBrideShort(e.target.value)} />
        </Field>
        <Field label="Nama Penuh Pengantin Perempuan" error={fieldErrors["bride.fullName"]}>
          <input className={inputClass} value={brideFull} onChange={(e) => setBrideFull(e.target.value)} />
        </Field>
        <Field label="Tarikh &amp; Masa Akad (ISO 8601)" error={fieldErrors.date}>
          <input className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Nama Hari (cth. Ahad)" error={fieldErrors.dayNameMs}>
          <input className={inputClass} value={dayNameMs} onChange={(e) => setDayNameMs(e.target.value)} />
        </Field>
        <Field label="Tarikh Paparan (cth. 01 November 2026)" error={fieldErrors.displayDate}>
          <input className={inputClass} value={displayDate} onChange={(e) => setDisplayDate(e.target.value)} />
        </Field>
        <Field label="Masa Tamat (ISO 8601)" error={fieldErrors.endTime}>
          <input className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
        <Field label="Tarikh Tutup RSVP (ISO 8601)" error={fieldErrors.rsvpDeadline}>
          <input className={inputClass} value={rsvpDeadline} onChange={(e) => setRsvpDeadline(e.target.value)} />
        </Field>
        <Field label="Tarikh Tutup RSVP (Paparan)" error={fieldErrors.rsvpDeadlineDisplay}>
          <input
            className={inputClass}
            value={rsvpDeadlineDisplay}
            onChange={(e) => setRsvpDeadlineDisplay(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Baris Tuan Rumah" error={fieldErrors["hosts.line"]}>
        <input className={inputClass} value={hostsLine} onChange={(e) => setHostsLine(e.target.value)} />
      </Field>
      <Field label="Nama Ibu Bapa (satu baris setiap satu)" error={fieldErrors["hosts.names"]}>
        <textarea
          className={inputClass}
          rows={3}
          value={hostsNames}
          onChange={(e) => setHostsNames(e.target.value)}
        />
      </Field>
      <Field label="Salam" error={fieldErrors.salam}>
        <textarea className={inputClass} rows={2} value={salam} onChange={(e) => setSalam(e.target.value)} />
      </Field>
      <Field label="Gelaran Jemputan" error={fieldErrors.honorifics}>
        <input className={inputClass} value={honorifics} onChange={(e) => setHonorifics(e.target.value)} />
      </Field>
      <Field label="Teks Jemputan (perenggan dipisah baris kosong)" error={fieldErrors.invitationBody}>
        <textarea
          className={inputClass}
          rows={4}
          value={invitationBody}
          onChange={(e) => setInvitationBody(e.target.value)}
        />
      </Field>
      <Field label="Doa Penutup" error={fieldErrors.doa}>
        <textarea className={inputClass} rows={3} value={doa} onChange={(e) => setDoa(e.target.value)} />
      </Field>

      <SaveBar pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

function LokasiTab({ initialConfig }: { initialConfig: WeddingConfig }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave();
  const [name, setName] = useState(initialConfig.venue.name);
  const [addressLines, setAddressLines] = useState(initialConfig.venue.addressLines.join("\n"));
  const [lat, setLat] = useState(String(initialConfig.venue.lat));
  const [lng, setLng] = useState(String(initialConfig.venue.lng));
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialConfig.venue.googleMapsUrl);
  const [wazeUrl, setWazeUrl] = useState(initialConfig.venue.wazeUrl);

  function handleSave() {
    void save({
      venue: {
        name,
        addressLines: addressLines
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        lat: Number(lat),
        lng: Number(lng),
        googleMapsUrl,
        wazeUrl,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nama Tempat" error={fieldErrors["venue.name"]}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Alamat (satu baris setiap satu)" error={fieldErrors["venue.addressLines"]}>
        <textarea
          className={inputClass}
          rows={3}
          value={addressLines}
          onChange={(e) => setAddressLines(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Latitud" error={fieldErrors["venue.lat"]}>
          <input className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Longitud" error={fieldErrors["venue.lng"]}>
          <input className={inputClass} value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
        </Field>
      </div>
      <Field label="Pautan Google Maps (https, google.com/goo.gl)" error={fieldErrors["venue.googleMapsUrl"]}>
        <input className={inputClass} value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} />
      </Field>
      <Field label="Pautan Waze (https, waze.com)" error={fieldErrors["venue.wazeUrl"]}>
        <input className={inputClass} value={wazeUrl} onChange={(e) => setWazeUrl(e.target.value)} />
      </Field>

      <SaveBar pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

type AturCaraRow = { time: string; label: string };

function AturCaraTab({ initialConfig }: { initialConfig: WeddingConfig }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave();
  const [rows, setRows] = useState<AturCaraRow[]>(initialConfig.aturCara.map((r) => ({ ...r })));

  function update(index: number, field: keyof AturCaraRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function add() {
    if (rows.length >= 30) return;
    setRows((prev) => [...prev, { time: "", label: "" }]);
  }

  function handleSave() {
    void save({ aturCara: rows });
  }

  return (
    <div className="flex flex-col gap-4">
      {fieldErrors.aturCara && (
        <p role="alert" className="text-xs text-red-700">
          {fieldErrors.aturCara}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-tan/30 p-2">
            <input
              className={`${inputClass} w-28`}
              value={row.time}
              placeholder="Masa"
              onChange={(e) => update(index, "time", e.target.value)}
            />
            <input
              className={`${inputClass} flex-1`}
              value={row.label}
              placeholder="Perkara"
              onChange={(e) => update(index, "label", e.target.value)}
            />
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              className="rounded-md border border-tan/40 px-2 py-1 text-xs text-brown-deep disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === rows.length - 1}
              className="rounded-md border border-tan/40 px-2 py-1 text-xs text-brown-deep disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Padam
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={rows.length >= 30}
        className="self-start rounded-md border border-tan/40 px-3 py-1.5 text-sm text-brown-deep disabled:opacity-40"
      >
        + Tambah Baris
      </button>

      <SaveBar pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

type ContactRow = { name: string; role: string; phone: string };

function HubungiTab({ initialConfig }: { initialConfig: WeddingConfig }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave();
  const [rows, setRows] = useState<ContactRow[]>(initialConfig.contacts.map((r) => ({ ...r })));

  function update(index: number, field: keyof ContactRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function add() {
    if (rows.length >= 30) return;
    setRows((prev) => [...prev, { name: "", role: "", phone: "" }]);
  }

  function handleSave() {
    void save({ contacts: rows });
  }

  return (
    <div className="flex flex-col gap-4">
      {fieldErrors.contacts && (
        <p role="alert" className="text-xs text-red-700">
          {fieldErrors.contacts}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-tan/30 p-2">
            <input
              className={`${inputClass} flex-1`}
              value={row.name}
              placeholder="Nama"
              onChange={(e) => update(index, "name", e.target.value)}
            />
            <input
              className={`${inputClass} flex-1`}
              value={row.role}
              placeholder="Peranan"
              onChange={(e) => update(index, "role", e.target.value)}
            />
            <input
              className={`${inputClass} w-40`}
              value={row.phone}
              placeholder="Telefon"
              onChange={(e) => update(index, "phone", e.target.value)}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Padam
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        disabled={rows.length >= 30}
        className="self-start rounded-md border border-tan/40 px-3 py-1.5 text-sm text-brown-deep disabled:opacity-40"
      >
        + Tambah Kenalan
      </button>

      <SaveBar pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

const SECTION_TOGGLE_LABELS: { key: keyof SectionsConfig; label: string }[] = [
  { key: "undangan", label: "Bahagian Undangan" },
  { key: "lokasi", label: "Bahagian Lokasi" },
  { key: "aturCara", label: "Bahagian Atur Cara" },
  { key: "countdown", label: "Bahagian Menghitung Hari" },
  { key: "galeri", label: "Bahagian Galeri" },
  { key: "ucapan", label: "Bahagian Ucapan (dinding + borang)" },
  { key: "kehadiran", label: "Bahagian Kehadiran (tallies)" },
  { key: "navKalendar", label: "Nav: Kalendar" },
  { key: "navLokasi", label: "Nav: Lokasi" },
  { key: "navHubungi", label: "Nav: Hubungi" },
  { key: "navRsvp", label: "Nav: RSVP (juga menutup penghantaran RSVP)" },
];

function BahagianTab({ initialConfig }: { initialConfig: { sections: SectionsConfig } }) {
  const { save, pending, error, success } = useSectionSave();
  const [sections, setSections] = useState<SectionsConfig>({ ...initialConfig.sections });

  function toggle(key: keyof SectionsConfig) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    void save({ sections });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-brown/70">
        Menutup bahagian &quot;RSVP&quot; atau &quot;Ucapan&quot; juga menyekat penghantaran borang
        berkaitan di pelayan — bukan sekadar menyembunyikannya.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SECTION_TOGGLE_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-brown-deep">
            <input type="checkbox" checked={sections[key]} onChange={() => toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <SaveBar pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}
