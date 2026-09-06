"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MAX_AUDIO_BYTES } from "@/lib/audio";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AdminDict, AdminLang } from "@/lib/i18n/admin-dict";

import { localizeApiError } from "./api-error";
import { formatDateTime } from "./format";
import { useAdminAction } from "./useAdminAction";

export type MusicTrackForSettings = {
  id: string;
  label: string;
  source: "preset" | "upload";
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
};

function formatBytes(n: number | null): string {
  if (n === null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type UploadResponse = { ok: true; id: string } | { ok: false; error: string; code?: string };

/**
 * The "Muzik Latar" panel on `/admin/settings`
 * (`src/app/admin/(protected)/settings/page.tsx`): pick which track plays
 * on the public invite, upload new ones, and delete old ones.
 *
 * Follows the same client-island pattern as `WishActions`/`RsvpDeleteButton`
 * (a plain server component page, a client component only for the
 * interactive bits) except for the upload form, which needs `FormData`
 * rather than JSON and so can't go through `useAdminAction` — it POSTs
 * directly, attaching the same CSRF header by hand.
 */
export function MusicSettings({
  tracks,
  activeValue,
  presetMusicPath,
  dict,
  lang,
}: {
  tracks: MusicTrackForSettings[];
  activeValue: string;
  presetMusicPath: string | null;
  dict: AdminDict;
  lang: AdminLang;
}) {
  const router = useRouter();
  const { run: runSelect, pending: selectPending, error: selectError } = useAdminAction(dict);
  const { run: runDelete, pending: deletePending, error: deleteError } = useAdminAction(dict);

  const [selected, setSelected] = useState(activeValue);
  const [label, setLabel] = useState("");
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [droppedName, setDroppedName] = useState<string | null>(null);

  async function handleSelect(value: string) {
    const previous = selected;
    setSelected(value);
    const ok = await runSelect("/api/admin/music/select", { value });
    if (!ok) setSelected(previous);
  }

  async function handleDelete(id: string) {
    const isActive = selected === id;
    const message = isActive ? dict.music_confirmDeleteActive : dict.music_confirmDelete;
    if (!window.confirm(message)) return;

    const ok = await runDelete("/api/admin/music/delete", { id });

    // The server moves the active setting to "none" when the deleted track
    // was the active one, but this component holds its own `selected` copy
    // for the radio group. Without mirroring it here that copy still points
    // at the deleted id, so `router.refresh()` re-renders a list where NO
    // radio matches and the group appears to have nothing chosen.
    if (ok && isActive) {
      setSelected("none");
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError(dict.music_selectAudioFile);
      return;
    }
    // Fast client-side feedback only — the server-side check on the
    // actually-decoded bytes in the upload route is the real authority.
    if (file.size > MAX_AUDIO_BYTES) {
      setUploadError(dict.music_fileTooLarge);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    if (label.trim()) formData.append("label", label.trim());

    setUploadPending(true);
    try {
      const response = await fetch("/api/admin/music/upload", {
        method: "POST",
        headers: csrfHeaders(),
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !data?.ok) {
        setUploadError(localizeApiError(dict, data && !data.ok ? data : null));
        return;
      }

      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setUploadError(dict.common_networkError);
    } finally {
      setUploadPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-tan/30 bg-sand/40 p-4">
      <h2 className="font-serif text-xl text-brown-deep">{dict.music_heading}</h2>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-brown-deep">
          <input
            type="radio"
            name="music-track"
            checked={selected === "none"}
            onChange={() => handleSelect("none")}
            disabled={selectPending}
          />
          <span>{dict.music_noMusic}</span>
        </label>

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm text-brown-deep">
            <input
              type="radio"
              name="music-track"
              checked={selected === "preset"}
              onChange={() => handleSelect("preset")}
              disabled={selectPending}
            />
            <span>{dict.music_defaultSong}</span>
          </label>
          {presetMusicPath ? (
            <audio
              controls
              preload="none"
              src={presetMusicPath}
              className="ml-6 h-8 max-w-xs"
            />
          ) : (
            <p className="ml-6 text-xs text-red-700">{dict.music_noPresetWarning}</p>
          )}
        </div>

        {tracks.length === 0 ? (
          <p className="ml-6 text-xs text-brown/60">{dict.music_noTracksUploaded}</p>
        ) : (
          tracks.map((track) => {
            const isActive = selected === track.id;
            return (
              <div key={track.id} className="flex flex-col gap-1 border-t border-tan/20 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-brown-deep">
                    <input
                      type="radio"
                      name="music-track"
                      checked={isActive}
                      onChange={() => handleSelect(track.id)}
                      disabled={selectPending}
                    />
                    <span className="font-medium">{track.label}</span>
                  </label>
                  <span className="text-xs text-brown/60">
                    {track.filename ?? "-"} · {formatBytes(track.sizeBytes)} ·{" "}
                    {formatDateTime(track.uploadedAt, lang)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(track.id)}
                    disabled={deletePending}
                    title={isActive ? dict.music_deleteActiveTitle : undefined}
                    className="ml-auto rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-40"
                  >
                    {dict.common_delete}
                  </button>
                </div>
                <audio
                  controls
                  preload="none"
                  src={`/api/music/${track.id}`}
                  className="ml-6 h-8 max-w-xs"
                />
              </div>
            );
          })
        )}
      </div>

      {(selectError || deleteError) && (
        <p role="alert" className="text-xs text-red-700">
          {selectError || deleteError}
        </p>
      )}

      <form onSubmit={handleUpload} className="flex flex-col gap-2 border-t border-tan/30 pt-4">
        <p className="text-sm font-medium text-brown-deep">{dict.music_uploadHeading}</p>

        <label htmlFor="music-label" className="text-xs text-brown/60">
          {dict.music_labelFieldLabel}
        </label>
        <input
          id="music-label"
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={60}
          disabled={uploadPending}
          placeholder={dict.music_labelPlaceholder}
          className="rounded-md border border-tan/40 bg-cream px-3 py-1.5 text-sm text-brown-deep"
        />

        {/*
          Drop target wrapping the real <input type="file">, rather than
          replacing it. The input stays in the DOM and keeps working: drag
          and drop is unusable by keyboard and awkward on a phone, so it is
          an addition, never the only way in.
        */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const dropped = event.dataTransfer.files?.[0];
            if (!dropped || !fileInputRef.current) return;
            // Assigning a DataTransfer's FileList to the input keeps the
            // form submitting exactly as it does for a picked file — one
            // upload path, not two.
            const transfer = new DataTransfer();
            transfer.items.add(dropped);
            fileInputRef.current.files = transfer.files;
            setDroppedName(dropped.name);
          }}
          className={`rounded-md border-2 border-dashed px-3 py-4 text-sm transition ${
            dragOver ? "border-goldenrod bg-tan/20" : "border-tan/40 bg-cream/50"
          }`}
        >
          <p className="mb-2 text-xs text-brown/70">{dict.music_dropHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,.mp3,.m4a"
            disabled={uploadPending}
            onChange={(event) => setDroppedName(event.target.files?.[0]?.name ?? null)}
            className="text-sm text-brown-deep"
          />
          {droppedName && <p className="mt-2 text-xs text-brown-deep">{droppedName}</p>}
        </div>

        <button
          type="submit"
          disabled={uploadPending}
          className="self-start rounded-md bg-goldenrod px-3 py-1.5 text-sm font-medium text-cream transition hover:bg-brown disabled:opacity-50"
        >
          {uploadPending ? dict.common_uploading : dict.common_upload}
        </button>

        {uploadError && (
          <p role="alert" className="text-xs text-red-700">
            {uploadError}
          </p>
        )}
      </form>
    </section>
  );
}
