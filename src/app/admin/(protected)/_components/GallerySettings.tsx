"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MAX_GALLERY_IMAGES, MAX_IMAGE_BYTES } from "@/lib/image";
import { csrfHeaders } from "@/lib/csrf-client";
import type { AdminDict, AdminLang } from "@/lib/i18n/admin-dict";
import { interpolate } from "@/lib/i18n/admin-dict";

import { localizeApiError } from "./api-error";
import { formatDateTime } from "./format";
import { useAdminAction } from "./useAdminAction";

export type GalleryImageForSettings = {
  id: string;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  alt: string;
  sortOrder: number;
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
 * The "Galeri" panel on `/admin/settings`
 * (`src/app/admin/(protected)/settings/page.tsx`): upload photos, edit
 * their alt text, reorder them (simple up/down buttons, no drag-and-drop),
 * and delete them.
 *
 * Follows the same client-island pattern as `MusicSettings` (a plain
 * server component page, a client component only for the interactive
 * bits) except the upload form, which needs `FormData` rather than JSON
 * and so can't go through `useAdminAction` — it POSTs directly, attaching
 * the same CSRF header by hand.
 */
export function GallerySettings({
  images,
  dict,
  lang,
}: {
  images: GalleryImageForSettings[];
  dict: AdminDict;
  lang: AdminLang;
}) {
  const router = useRouter();
  const { run: runDelete, pending: deletePending, error: deleteError } = useAdminAction(dict);
  const { run: runReorder, pending: reorderPending, error: reorderError } = useAdminAction(dict);

  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  const [altPendingId, setAltPendingId] = useState<string | null>(null);
  const [altError, setAltError] = useState<string | null>(null);

  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_GALLERY_IMAGES - images.length;

  function altValue(image: GalleryImageForSettings): string {
    return altDrafts[image.id] ?? image.alt;
  }

  async function handleSaveAlt(id: string) {
    const alt = (altDrafts[id] ?? "").trim();
    if (!alt) {
      setAltError(dict.gallery_altEmptyError);
      return;
    }
    setAltPendingId(id);
    setAltError(null);
    try {
      const response = await fetch("/api/admin/gallery/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        body: JSON.stringify({ id, alt }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok: true }
        | { ok: false; error: string; code?: string }
        | null;
      if (!response.ok || !data?.ok) {
        setAltError(localizeApiError(dict, data && !data.ok ? data : null));
        return;
      }
      router.refresh();
    } catch {
      setAltError(dict.common_networkError);
    } finally {
      setAltPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(dict.gallery_confirmDelete)) return;
    await runDelete("/api/admin/gallery/delete", { id });
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    await runReorder("/api/admin/gallery/reorder", { ids: reordered.map((img) => img.id) });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);

    if (remaining <= 0) {
      setUploadError(dict.errors_galleryFull);
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError(dict.gallery_selectImageFile);
      return;
    }
    // Fast client-side feedback only — the server-side check on the
    // actually-decoded bytes in the upload route is the real authority.
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setUploadError(dict.gallery_unsupportedFormat);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError(dict.gallery_fileTooLarge);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadPending(true);
    try {
      const response = await fetch("/api/admin/gallery/upload", {
        method: "POST",
        headers: csrfHeaders(),
        body: formData,
      });

      const data = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !data?.ok) {
        setUploadError(localizeApiError(dict, data && !data.ok ? data : null));
        return;
      }

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
      <h2 className="font-serif text-xl text-brown-deep">{dict.gallery_heading}</h2>

      {images.length === 0 ? (
        <p className="text-xs text-brown/60">{dict.gallery_emptyState}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="flex flex-col gap-2 rounded-lg border border-tan/20 bg-cream p-2"
            >
              {/*
                `unoptimized`: same reasoning as the public Galeri
                component — uploaded images are served from
                `/api/gallery/<id>`, and the Cloudflare image-optimization
                binding isn't configured.
              */}
              <div className="relative aspect-square w-full overflow-hidden rounded-md bg-sand">
                <Image
                  src={`/api/gallery/${image.id}`}
                  alt={image.alt}
                  fill
                  unoptimized
                  sizes="200px"
                  className="object-cover"
                />
              </div>

              <input
                type="text"
                value={altValue(image)}
                onChange={(event) =>
                  setAltDrafts((prev) => ({ ...prev, [image.id]: event.target.value }))
                }
                maxLength={150}
                disabled={altPendingId === image.id}
                placeholder={dict.gallery_altPlaceholder}
                className="rounded-md border border-tan/40 bg-sand/40 px-2 py-1 text-xs text-brown-deep"
              />

              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => handleSaveAlt(image.id)}
                  disabled={altPendingId === image.id || altValue(image) === image.alt}
                  className="rounded-md border border-tan/40 px-2 py-1 text-xs text-brown-deep transition hover:bg-sand/60 disabled:opacity-40"
                >
                  {dict.common_save}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0 || reorderPending}
                    aria-label={dict.wc_moveUp}
                    className="rounded-md border border-tan/40 px-1.5 py-1 text-xs text-brown-deep transition hover:bg-sand/60 disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === images.length - 1 || reorderPending}
                    aria-label={dict.wc_moveDown}
                    className="rounded-md border border-tan/40 px-1.5 py-1 text-xs text-brown-deep transition hover:bg-sand/60 disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(image.id)}
                  disabled={deletePending}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50 disabled:opacity-40"
                >
                  {dict.common_delete}
                </button>
              </div>

              <p className="text-[10px] text-brown/50">
                {image.filename ?? "-"} · {formatBytes(image.sizeBytes)} ·{" "}
                {formatDateTime(image.uploadedAt, lang)}
              </p>
            </div>
          ))}
        </div>
      )}

      {(deleteError || reorderError || altError) && (
        <p role="alert" className="text-xs text-red-700">
          {deleteError || reorderError || altError}
        </p>
      )}

      <form onSubmit={handleUpload} className="flex flex-col gap-2 border-t border-tan/30 pt-4">
        <p className="text-sm font-medium text-brown-deep">
          {interpolate(dict.gallery_uploadHeading, { remaining, max: MAX_GALLERY_IMAGES })}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploadPending || remaining <= 0}
          className="text-sm text-brown-deep"
        />

        <button
          type="submit"
          disabled={uploadPending || remaining <= 0}
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
