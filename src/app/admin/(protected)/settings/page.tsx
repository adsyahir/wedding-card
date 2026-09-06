import { wedding } from "@/config/wedding";
import { getActiveMusicSetting, listGalleryImagesForAdmin, listMusicTracks } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";
import { getStoredWeddingConfigDoc, getWeddingConfig } from "@/lib/wedding-config";

import { GallerySettings } from "../_components/GallerySettings";
import { MusicSettings } from "../_components/MusicSettings";
import { WeddingConfigSettings } from "../_components/WeddingConfigSettings";

// Never statically optimized/cached — every request must actually run the
// guard below and fetch fresh data.
export const dynamic = "force-dynamic";

/**
 * `/admin/settings` — "Kandungan Kad Jemputan" (the admin-editable wedding
 * config, tabbed) and "Muzik Latar" (background music).
 */
export default async function AdminSettingsPage() {
  // Defense in depth: the `(protected)` layout already calls `requireAdmin()`,
  // but every page under it calls it again independently — never rely on
  // the layout's call alone.
  await requireAdmin();

  const [tracks, activeSetting, config, storedDoc, galleryImages] = await Promise.all([
    listMusicTracks(),
    getActiveMusicSetting(),
    getWeddingConfig(),
    getStoredWeddingConfigDoc(),
    listGalleryImagesForAdmin(),
  ]);

  // Mirrors `getActiveMusicSrc`'s own resolution (src/db/queries/public.ts):
  // an unset row defaults to "preset", same as the public invite does.
  const activeValue = activeSetting ?? "preset";
  const isOverridden = Object.keys(storedDoc).length > 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-2xl text-brown-deep">Tetapan</h1>

      <WeddingConfigSettings initialConfig={config} isOverridden={isOverridden} />

      <MusicSettings
        tracks={tracks}
        activeValue={activeValue}
        presetMusicPath={wedding.presetMusicPath}
      />

      <GallerySettings images={galleryImages} />
    </div>
  );
}
