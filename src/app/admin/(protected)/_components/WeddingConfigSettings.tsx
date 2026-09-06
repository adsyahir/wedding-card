"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import type { WeddingConfig } from "@/config/wedding";
import { SCRIPT_FONT_KEYS, type ScriptFontKey } from "@/lib/script-font";
import type { SectionsConfig } from "@/lib/wedding-config";
import { csrfHeaders } from "@/lib/csrf-client";
import { buildMapEmbedUrl } from "@/lib/map-embed";
import {
  formatMalayTime,
  isoToParts,
  malayDayName,
  malayDisplayDate,
  malayFullPreview,
  partsToIso,
} from "@/lib/datetime-my";

import type { AdminDict } from "@/lib/i18n/admin-dict";

import { localizeApiError, localizeFieldErrors } from "./api-error";
import { ConfirmDialog } from "./ConfirmDialog";
import { TrashIcon } from "./TrashIcon";

type ApiResponse =
  | { ok: true }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

const TABS = ["butiran", "lokasi", "aturcara", "hubungi", "bahagian"] as const;
type Tab = (typeof TABS)[number];

/**
 * Panels that live in this same tab strip but own their own data and API
 * routes (Galeri, Muzik, Notifikasi). They used to be rendered BELOW the
 * tabs on the settings page, which meant they appeared on every tab at
 * once — the tab strip looked like it only governed the five config tabs
 * while three more panels sat under all of them permanently. Passing them
 * in here gives the page one tab strip with one selection, which is what
 * the strip already looked like it was promising.
 */
export type ExtraSettingsTab = { id: string; label: string; content: ReactNode };

/**
 * Posts one slice of the wedding config JSON doc to
 * `POST /api/admin/settings/wedding` (see `src/lib/wedding-config.ts` for
 * the merge-on-save semantics: each tab only ever sends the fields it
 * owns). Returns per-field error messages on validation failure — these
 * come straight from the Zod schema in `src/lib/wedding-config.ts` and are
 * NOT localized (see the README / task notes: they're a large, fixed set
 * of Malay-ish messages out of scope for this pass), only the top-level
 * `error` summary is.
 */
async function saveSlice(
  dict: AdminDict,
  slice: unknown,
): Promise<{ ok: true } | { ok: false; error: string; fieldErrors: Record<string, string> }> {
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
        error: localizeApiError(dict, data && !data.ok ? data : null),
        fieldErrors: (data && !data.ok && data.fieldErrors) || {},
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: dict.common_networkError, fieldErrors: {} };
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

/** CSS `font-family` value for each `scriptFont` option, matching the
 * `html[data-script-font=...]` rules in globals.css — used to render each
 * dropdown option (and the live preview line) IN that font, so the admin
 * can see what they're choosing before saving. */
const SCRIPT_FONT_FAMILY: Record<ScriptFontKey, string> = {
  parisienne: "var(--font-parisienne), cursive",
  greatVibes: "var(--font-great-vibes), cursive",
  dancingScript: "var(--font-dancing-script), cursive",
  sacramento: "var(--font-sacramento), cursive",
  cormorantGaramond: "var(--font-cormorant), serif",
};

/**
 * Lets `SaveBar` render the Restore-to-default button on the far right of
 * the same row as Simpan, even though the reset state lives up in
 * `WeddingConfigSettings`. Context rather than props because every one of
 * the five tab components sits in between and none of them cares.
 */
const ResetContext = createContext<{
  onReset: () => void;
  pending: boolean;
  label: string;
} | null>(null);

function SaveBar({
  dict,
  pending,
  error,
  success,
  onSave,
}: {
  dict: AdminDict;
  pending: boolean;
  error: string | null;
  success: boolean;
  onSave: () => void;
}) {
  const reset = useContext(ResetContext);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-tan/30 pt-4">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="cursor-pointer rounded-md bg-goldenrod px-4 py-1.5 text-sm font-medium text-cream transition hover:bg-brown disabled:opacity-50"
      >
        {pending ? dict.common_saving : dict.common_save}
      </button>
      {success && <span className="text-xs text-green-700">{dict.common_saved}</span>}
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}

      {/* Far right, opposite Simpan. Same row so the panel ends in one
          bar instead of two, but the full width of the card between them
          so the destructive one is never the button next to your cursor. */}
      {reset && (
        <button
          type="button"
          onClick={reset.onReset}
          disabled={reset.pending}
          className="ml-auto cursor-pointer rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-40"
        >
          {reset.label}
        </button>
      )}
    </div>
  );
}

function useSectionSave(dict: AdminDict) {
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
    const result = await saveSlice(dict, slice);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFieldErrors(localizeFieldErrors(dict, result.fieldErrors));
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
  dict,
  extraTabs = [],
}: {
  initialConfig: WeddingConfig & { sections: SectionsConfig };
  dict: AdminDict;
  extraTabs?: ExtraSettingsTab[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("butiran");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const TAB_LABELS: Record<Tab, string> = {
    butiran: dict.wc_tabButiran,
    lokasi: dict.wc_tabLokasi,
    aturcara: dict.wc_tabAturCara,
    hubungi: dict.wc_tabHubungi,
    bahagian: dict.wc_tabBahagian,
  };

  const allTabs = [
    ...TABS.map((id) => ({ id: id as string, label: TAB_LABELS[id] })),
    ...extraTabs.map(({ id, label }) => ({ id, label })),
  ];

  async function handleReset() {
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
        setResetError(localizeApiError(dict, data && !data.ok ? data : null));
        return;
      }
      router.refresh();
    } catch {
      setResetError(dict.common_networkError);
    } finally {
      setResetPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-tan/30 bg-sand/40 p-3 sm:p-4">
      <h2 className="font-serif text-lg text-brown-deep sm:text-xl">{dict.wc_heading}</h2>
      {resetError && (
        <p role="alert" className="text-xs text-red-700">
          {resetError}
        </p>
      )}

      {/*
        On a phone: a native <select>. The scrolling pill row that was here
        hid half its options off the right edge, so you had to know a tab
        existed before you could scroll to it — and scrolling a row of tap
        targets invites selecting one by accident. The OS picker shows every
        tab at once and cannot be mistapped.
      */}
      <label className="sm:hidden">
        <span className="sr-only">{dict.wc_tabsAriaLabel}</span>
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-tan/50 bg-cream px-3 py-2.5 text-sm font-medium text-brown-deep"
        >
          {allTabs.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div
        role="tablist"
        aria-label={dict.wc_tabsAriaLabel}
        className="no-scrollbar -mx-1 hidden gap-2 overflow-x-auto px-1 sm:flex"
      >
        {allTabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap ${
              tab === id
                ? "border-goldenrod bg-tan text-brown-deep"
                : "border-tan/40 bg-cream text-brown-deep"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ResetContext.Provider
        value={{
          onReset: () => setResetOpen(true),
          pending: resetPending,
          label: resetPending ? dict.wc_resetting : dict.wc_resetButton,
        }}
      >
        {tab === "butiran" && <ButiranTab initialConfig={initialConfig} dict={dict} />}
        {tab === "lokasi" && <LokasiTab initialConfig={initialConfig} dict={dict} />}
        {tab === "aturcara" && <AturCaraTab initialConfig={initialConfig} dict={dict} />}
        {tab === "hubungi" && <HubungiTab initialConfig={initialConfig} dict={dict} />}
        {tab === "bahagian" && <BahagianTab initialConfig={initialConfig} dict={dict} />}
      </ResetContext.Provider>

      {/* Outside the provider: the gallery, music and notification panels
          have their own save controls, and Restore-to-default does not
          touch what they edit. */}
      {extraTabs.find((t) => t.id === tab)?.content}


      {/*
        Restoring defaults throws away every setting the couple has entered
        — names, venue, itinerary, contacts — with no undo, so it asks for
        the word to be typed rather than accepting a reflexive second click.
      */}
      <ConfirmDialog
        open={resetOpen}
        title={dict.wc_resetConfirmTitle}
        body={dict.wc_resetConfirm}
        confirmLabel={dict.wc_resetButton}
        requirePhrase={dict.wc_resetPhrase}
        dict={dict}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          void handleReset();
        }}
      />
    </section>
  );
}

function ButiranTab({
  initialConfig,
  dict,
}: {
  initialConfig: WeddingConfig;
  dict: AdminDict;
}) {
  const { save, pending, error, success, fieldErrors } = useSectionSave(dict);
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
  // The config stores ISO strings plus separate human display strings. The
  // admin edits four native pickers instead, and every stored field is
  // DERIVED from them on save — so the day name and display date can never
  // drift out of sync with the actual date (they previously could).
  const initialStart = isoToParts(initialConfig.date);
  const initialEnd = isoToParts(initialConfig.endTime);
  const initialDeadline = isoToParts(initialConfig.rsvpDeadline);
  const [eventDate, setEventDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endTimeOfDay, setEndTimeOfDay] = useState(initialEnd.time);
  const [deadlineDate, setDeadlineDate] = useState(initialDeadline.date);
  const [hashtag, setHashtag] = useState(initialConfig.hashtag);
  const [doa, setDoa] = useState(initialConfig.doa);
  const [scriptFont, setScriptFont] = useState<ScriptFontKey>(initialConfig.scriptFont);

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
      date: partsToIso(eventDate, startTime),
      dayNameMs: malayDayName(eventDate),
      displayDate: malayDisplayDate(eventDate),
      endTime: partsToIso(eventDate, endTimeOfDay),
      rsvpDeadline: partsToIso(deadlineDate, "23:59", "59"),
      rsvpDeadlineDisplay: malayDisplayDate(deadlineDate),
      hashtag,
      doa,
      scriptFont,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={dict.wc_eventType} error={fieldErrors.eventType}>
          <input className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)} />
        </Field>
        <Field label={dict.wc_hashtag} error={fieldErrors.hashtag}>
          <input className={inputClass} value={hashtag} onChange={(e) => setHashtag(e.target.value)} />
        </Field>
        <Field label={dict.wc_groomShort} error={fieldErrors["groom.shortName"]}>
          <input className={inputClass} value={groomShort} onChange={(e) => setGroomShort(e.target.value)} />
        </Field>
        <Field label={dict.wc_groomFull} error={fieldErrors["groom.fullName"]}>
          <input className={inputClass} value={groomFull} onChange={(e) => setGroomFull(e.target.value)} />
        </Field>
        <Field label={dict.wc_brideShort} error={fieldErrors["bride.shortName"]}>
          <input className={inputClass} value={brideShort} onChange={(e) => setBrideShort(e.target.value)} />
        </Field>
        <Field label={dict.wc_brideFull} error={fieldErrors["bride.fullName"]}>
          <input className={inputClass} value={brideFull} onChange={(e) => setBrideFull(e.target.value)} />
        </Field>
        <Field label={dict.wc_eventDate} error={fieldErrors.date || fieldErrors.dayNameMs || fieldErrors.displayDate}>
          <input
            type="date"
            className={inputClass}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </Field>
        <Field label={dict.wc_startTime}>
          <input
            type="time"
            className={inputClass}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field label={dict.wc_endTimeOfDay} error={fieldErrors.endTime}>
          <input
            type="time"
            className={inputClass}
            value={endTimeOfDay}
            onChange={(e) => setEndTimeOfDay(e.target.value)}
          />
        </Field>
        <Field label={dict.wc_rsvpDeadlineDate} error={fieldErrors.rsvpDeadline || fieldErrors.rsvpDeadlineDisplay}>
          <input
            type="date"
            className={inputClass}
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
          />
        </Field>
      </div>

      {/* Live preview of everything derived from the pickers above, so the
          admin can see exactly what the card will say before saving. */}
      <div className="rounded-md border border-gold-light/60 bg-sand/50 px-3 py-2 text-sm text-brown">
        <div className="font-medium text-brown-deep">{dict.wc_previewHeading}</div>
        <div>{malayFullPreview(eventDate, startTime) || "-"}</div>
        <div className="text-brown/70">
          {dict.wc_previewEnds}: {formatMalayTime(endTimeOfDay) || "-"}
        </div>
        <div className="text-brown/70">
          {dict.wc_previewDeadline}: {malayDisplayDate(deadlineDate) || "-"}
        </div>
      </div>

      <Field label={dict.wc_hostsLine} error={fieldErrors["hosts.line"]}>
        <input className={inputClass} value={hostsLine} onChange={(e) => setHostsLine(e.target.value)} />
      </Field>
      <Field label={dict.wc_hostsNames} error={fieldErrors["hosts.names"]}>
        <textarea
          className={inputClass}
          rows={3}
          value={hostsNames}
          onChange={(e) => setHostsNames(e.target.value)}
        />
      </Field>
      <Field label={dict.wc_salam} error={fieldErrors.salam}>
        <textarea className={inputClass} rows={2} value={salam} onChange={(e) => setSalam(e.target.value)} />
      </Field>
      <Field label={dict.wc_honorifics} error={fieldErrors.honorifics}>
        <input className={inputClass} value={honorifics} onChange={(e) => setHonorifics(e.target.value)} />
      </Field>
      <Field label={dict.wc_invitationBody} error={fieldErrors.invitationBody}>
        <textarea
          className={inputClass}
          rows={4}
          value={invitationBody}
          onChange={(e) => setInvitationBody(e.target.value)}
        />
      </Field>
      <Field label={dict.wc_doa} error={fieldErrors.doa}>
        <textarea className={inputClass} rows={3} value={doa} onChange={(e) => setDoa(e.target.value)} />
      </Field>

      <Field label={dict.wc_scriptFontLabel} error={fieldErrors.scriptFont}>
        <select
          className={inputClass}
          value={scriptFont}
          onChange={(e) => setScriptFont(e.target.value as ScriptFontKey)}
        >
          {SCRIPT_FONT_KEYS.map((key) => (
            <option key={key} value={key} style={{ fontFamily: SCRIPT_FONT_FAMILY[key] }}>
              {dict[`wc_scriptFont_${key}` as const]}
            </option>
          ))}
        </select>
      </Field>
      <div className="rounded-md border border-gold-light/60 bg-sand/50 px-3 py-2 text-sm text-brown">
        <div className="font-medium text-brown-deep">{dict.wc_scriptFontPreview}</div>
        <div
          className="mt-1 text-2xl text-brown-deep"
          style={{ fontFamily: SCRIPT_FONT_FAMILY[scriptFont] }}
        >
          {groomShort || "..."} &amp; {brideShort || "..."}
        </div>
      </div>

      <SaveBar dict={dict} pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

function LokasiTab({ initialConfig, dict }: { initialConfig: WeddingConfig; dict: AdminDict }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave(dict);
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
        // Blank means "not set", not zero. `Number("")` is 0, so sending it
        // raw would silently save coordinates at 0,0 — in the Gulf of Guinea
        // — the moment someone cleared the field.
        lat: lat.trim() === "" ? null : Number(lat),
        lng: lng.trim() === "" ? null : Number(lng),
        googleMapsUrl,
        wazeUrl,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label={dict.wc_venueName} error={fieldErrors["venue.name"]}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={dict.wc_venueAddress} error={fieldErrors["venue.addressLines"]}>
        <textarea
          className={inputClass}
          rows={3}
          value={addressLines}
          onChange={(e) => setAddressLines(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={dict.wc_venueLat} error={fieldErrors["venue.lat"]}>
          <input className={inputClass} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label={dict.wc_venueLng} error={fieldErrors["venue.lng"]}>
          <input className={inputClass} value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
        </Field>
      </div>
      <Field label={dict.wc_venueGmaps} error={fieldErrors["venue.googleMapsUrl"]}>
        <input className={inputClass} value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)} />
      </Field>
      <Field label={dict.wc_venueWaze} error={fieldErrors["venue.wazeUrl"]}>
        <input className={inputClass} value={wazeUrl} onChange={(e) => setWazeUrl(e.target.value)} />
      </Field>

      <MapPreview
        dict={dict}
        name={name}
        addressLines={addressLines}
        lat={lat}
        lng={lng}
        googleMapsUrl={googleMapsUrl}
      />

      <SaveBar dict={dict} pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

/**
 * A live preview of the embedded map, below the venue fields.
 *
 * It renders exactly what `buildMapEmbedUrl` will render on the public
 * page, from the same inputs and in the same order of preference: the
 * pasted Google Maps link first, then the typed name and address. That is
 * why it earns its place — geocoding is the step that can quietly land the
 * pin in the wrong town, and without a preview nobody notices until a
 * guest is lost on the day.
 *
 * The URL is debounced rather than rebuilt per keystroke: changing the src
 * of an iframe reloads it, so typing an address without this would fire off
 * a request to Google for every character.
 */
function MapPreview({
  dict,
  name,
  addressLines,
  lat,
  lng,
  googleMapsUrl,
}: {
  dict: AdminDict;
  name: string;
  addressLines: string;
  lat: string;
  lng: string;
  googleMapsUrl: string;
}) {
  const live = buildMapEmbedUrl({
    name,
    addressLines: addressLines.split("\n").map((l) => l.trim()).filter(Boolean),
    lat: lat.trim() === "" || Number.isNaN(Number(lat)) ? null : Number(lat),
    lng: lng.trim() === "" || Number.isNaN(Number(lng)) ? null : Number(lng),
    googleMapsUrl,
  });

  const [settled, setSettled] = useState(live);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(live), 700);
    return () => window.clearTimeout(timer);
  }, [live]);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-wide text-brown/80 uppercase">
        {dict.wc_mapPreview}
      </span>

      {settled === null ? (
        <p className="rounded-lg border border-dashed border-tan/50 px-4 py-8 text-center text-sm text-brown/70">
          {dict.wc_mapPreviewNone}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-tan/40">
          <iframe
            key={settled}
            src={settled}
            title={dict.wc_mapPreview}
            className="block h-56 w-full sm:h-72"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      <p className="text-xs leading-5 text-brown/70">{dict.wc_mapPreviewHint}</p>
    </div>
  );
}

type AturCaraRow = { time: string; label: string };

function AturCaraTab({ initialConfig, dict }: { initialConfig: WeddingConfig; dict: AdminDict }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave(dict);
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
              className={`${inputClass} w-24 shrink-0 sm:w-28`}
              value={row.time}
              placeholder={dict.wc_aturCaraTimePlaceholder}
              onChange={(e) => update(index, "time", e.target.value)}
            />
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={row.label}
              placeholder={dict.wc_aturCaraLabelPlaceholder}
              onChange={(e) => update(index, "label", e.target.value)}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={dict.wc_moveUp}
                className="rounded-md border border-tan/40 px-2 py-1 text-xs text-brown-deep disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                aria-label={dict.wc_moveDown}
                className="rounded-md border border-tan/40 px-2 py-1 text-xs text-brown-deep disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                <TrashIcon />
                {dict.common_delete}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={rows.length >= 30}
        className="self-start rounded-md border border-tan/40 px-3 py-1.5 text-sm text-brown-deep disabled:opacity-40"
      >
        {dict.wc_addRow}
      </button>

      <SaveBar dict={dict} pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

type ContactRow = { name: string; role: string; phone: string };

function HubungiTab({ initialConfig, dict }: { initialConfig: WeddingConfig; dict: AdminDict }) {
  const { save, pending, error, success, fieldErrors } = useSectionSave(dict);
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
              placeholder={dict.wc_contactNamePlaceholder}
              onChange={(e) => update(index, "name", e.target.value)}
            />
            <input
              className={`${inputClass} flex-1`}
              value={row.role}
              placeholder={dict.wc_contactRolePlaceholder}
              onChange={(e) => update(index, "role", e.target.value)}
            />
            <input
              className={`${inputClass} w-40`}
              value={row.phone}
              placeholder={dict.wc_contactPhonePlaceholder}
              onChange={(e) => update(index, "phone", e.target.value)}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              <TrashIcon />
              {dict.common_delete}
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
        {dict.wc_addContact}
      </button>

      <SaveBar dict={dict} pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}

function BahagianTab({
  initialConfig,
  dict,
}: {
  initialConfig: {
    sections: SectionsConfig;
    rsvpPaxMode: WeddingConfig["rsvpPaxMode"];
    siteMode: WeddingConfig["siteMode"];
    siteClosedMessage: string | null;
  };
  dict: AdminDict;
}) {
  const { save, pending, error, success } = useSectionSave(dict);
  const [sections, setSections] = useState<SectionsConfig>({ ...initialConfig.sections });
  const [rsvpPaxMode, setRsvpPaxMode] = useState(initialConfig.rsvpPaxMode);
  const [siteMode, setSiteMode] = useState(initialConfig.siteMode);
  const [siteClosedMessage, setSiteClosedMessage] = useState(initialConfig.siteClosedMessage ?? "");

  const SECTION_TOGGLE_LABELS: { key: keyof SectionsConfig; label: string }[] = [
    { key: "undangan", label: dict.wc_sectionUndangan },
    { key: "lokasi", label: dict.wc_sectionLokasi },
    { key: "aturCara", label: dict.wc_sectionAturCara },
    { key: "countdown", label: dict.wc_sectionCountdown },
    { key: "galeri", label: dict.wc_sectionGaleri },
    { key: "ucapan", label: dict.wc_sectionUcapan },
    { key: "kehadiran", label: dict.wc_sectionKehadiran },
    { key: "kalendarGrid", label: dict.wc_sectionKalendarGrid },
    { key: "navKalendar", label: dict.wc_navKalendar },
    { key: "navLokasi", label: dict.wc_navLokasi },
    { key: "navHubungi", label: dict.wc_navHubungi },
    { key: "navRsvp", label: dict.wc_navRsvp },
  ];

  function toggle(key: keyof SectionsConfig) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    void save({
      sections,
      rsvpPaxMode,
      siteMode,
      siteClosedMessage: siteClosedMessage.trim() === "" ? null : siteClosedMessage.trim(),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/*
        Site status sits above the per-section toggles because it overrides
        all of them: anything other than "live" replaces the whole card with
        a notice and closes the public write endpoints.
      */}
      <div className="rounded-md border border-gold-light/60 bg-sand/40 px-3 py-3">
        <label
          htmlFor="site-mode"
          className="mb-1 block text-sm font-medium text-brown-deep"
        >
          {dict.wc_siteModeLabel}
        </label>
        <select
          id="site-mode"
          value={siteMode}
          onChange={(event) => setSiteMode(event.target.value as WeddingConfig["siteMode"])}
          className="w-full rounded-md border border-tan/40 bg-cream px-3 py-1.5 text-sm text-brown-deep"
        >
          <option value="live">{dict.wc_siteModeLive}</option>
          <option value="maintenance">{dict.wc_siteModeMaintenance}</option>
          <option value="ended">{dict.wc_siteModeEnded}</option>
        </select>

        {siteMode !== "live" && (
          <div className="mt-3">
            <label
              htmlFor="site-closed-message"
              className="mb-1 block text-sm font-medium text-brown-deep"
            >
              {dict.wc_siteClosedMessageLabel}
            </label>
            <textarea
              id="site-closed-message"
              value={siteClosedMessage}
              onChange={(event) => setSiteClosedMessage(event.target.value.slice(0, 300))}
              rows={2}
              maxLength={300}
              placeholder={dict.wc_siteClosedMessagePlaceholder}
              className="w-full rounded-md border border-tan/40 bg-cream px-3 py-1.5 text-sm text-brown-deep"
            />
            <p className="mt-1 text-xs text-red-700">{dict.wc_siteModeWarning}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-brown/70">{dict.wc_sectionsNotice}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SECTION_TOGGLE_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-brown-deep">
            <input type="checkbox" checked={sections[key]} onChange={() => toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="mt-2 border-t border-gold-light/50 pt-4">
        <label className="flex items-center gap-2 text-sm text-brown-deep">
          <input
            type="checkbox"
            checked={sections.petaEmbed}
            onChange={() => toggle("petaEmbed")}
          />
          <span>{dict.wc_sectionPetaEmbed}</span>
        </label>
        <p className="mt-1 text-xs text-brown/70">{dict.wc_petaEmbedPrivacyNotice}</p>
      </div>

      <div className="mt-2 border-t border-gold-light/50 pt-4">
        <p className="mb-1 text-sm font-medium text-brown-deep">{dict.wc_paxModeLabel}</p>
        <p className="mb-2 text-xs text-brown/70">{dict.wc_paxModeNotice}</p>
        <div className="flex flex-col gap-2">
          {(
            [
              { value: "adultsChildren", label: dict.wc_paxModeAdultsChildren },
              { value: "total", label: dict.wc_paxModeTotal },
              { value: "none", label: dict.wc_paxModeNone },
            ] as const
          ).map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-brown-deep">
              <input
                type="radio"
                name="rsvpPaxMode"
                value={option.value}
                checked={rsvpPaxMode === option.value}
                onChange={() => setRsvpPaxMode(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <SaveBar dict={dict} pending={pending} error={error} success={success} onSave={handleSave} />
    </div>
  );
}
