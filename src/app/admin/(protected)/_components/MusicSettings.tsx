"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MAX_AUDIO_BYTES } from "@/lib/audio";
import { csrfHeaders } from "@/lib/csrf-client";

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

type UploadResponse = { ok: true; id: string } | { ok: false; error: string };

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
}: {
  tracks: MusicTrackForSettings[];
  activeValue: string;
  presetMusicPath: string | null;
}) {
  const router = useRouter();
  const { run: runSelect, pending: selectPending, error: selectError } = useAdminAction();
  const { run: runDelete, pending: deletePending, error: deleteError } = useAdminAction();

  const [selected, setSelected] = useState(activeValue);
  const [label, setLabel] = useState("");
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSelect(value: string) {
    const previous = selected;
    setSelected(value);
    const ok = await runSelect("/api/admin/music/select", { value });
    if (!ok) setSelected(previous);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Padam trek muzik ini? Tindakan ini tidak boleh dibatalkan.")) return;
    await runDelete("/api/admin/music/delete", { id });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Sila pilih fail audio.");
      return;
    }
    // Fast client-side feedback only — the server-side check on the
    // actually-decoded bytes in the upload route is the real authority.
    if (file.size > MAX_AUDIO_BYTES) {
      setUploadError("Saiz fail terlalu besar (had 8 MB).");
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
        setUploadError((data && !data.ok && data.error) || "Ralat tidak dijangka. Sila cuba lagi.");
        return;
      }

      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setUploadError("Ralat rangkaian. Sila cuba lagi.");
    } finally {
      setUploadPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-tan/30 bg-sand/40 p-4">
      <h2 className="font-serif text-xl text-brown-deep">Muzik Latar</h2>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-brown-deep">
          <input
            type="radio"
            name="music-track"
            checked={selected === "none"}
            onChange={() => handleSelect("none")}
            disabled={selectPending}
          />
          <span>Tiada muzik</span>
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
            <span>Lagu lalai</span>
          </label>
          {presetMusicPath ? (
            <audio
              controls
              preload="none"
              src={presetMusicPath}
              className="ml-6 h-8 max-w-xs"
            />
          ) : (
            <p className="ml-6 text-xs text-red-700">
              Tiada fail lagu lalai dibundel (`presetMusicPath` kosong dalam{" "}
              <code>src/config/wedding.ts</code>). Jika dipilih, tiada muzik akan dimainkan.
            </p>
          )}
        </div>

        {tracks.length === 0 ? (
          <p className="ml-6 text-xs text-brown/60">Belum ada trek dimuat naik.</p>
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
                    {formatDateTime(track.uploadedAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(track.id)}
                    disabled={isActive || deletePending}
                    title={
                      isActive
                        ? "Tidak boleh memadam trek yang sedang aktif — tukar muzik dahulu"
                        : undefined
                    }
                    className="ml-auto rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-40"
                  >
                    Padam
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
        <p className="text-sm font-medium text-brown-deep">Muat naik trek baharu</p>

        <label htmlFor="music-label" className="text-xs text-brown/60">
          Label (pilihan — lalai kepada nama fail)
        </label>
        <input
          id="music-label"
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={60}
          disabled={uploadPending}
          placeholder="cth. Lagu Cinta"
          className="rounded-md border border-tan/40 bg-cream px-3 py-1.5 text-sm text-brown-deep"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mpeg,audio/mp4,.mp3,.m4a"
          disabled={uploadPending}
          className="text-sm text-brown-deep"
        />

        <button
          type="submit"
          disabled={uploadPending}
          className="self-start rounded-md bg-goldenrod px-3 py-1.5 text-sm font-medium text-cream transition hover:bg-brown disabled:opacity-50"
        >
          {uploadPending ? "Memuat naik..." : "Muat Naik"}
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
