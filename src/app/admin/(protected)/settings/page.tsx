import { wedding } from "@/config/wedding";
import { getActiveMusicSetting, listMusicTracks } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";

import { MusicSettings } from "../_components/MusicSettings";

// Never statically optimized/cached — every request must actually run the
// guard below and fetch fresh data.
export const dynamic = "force-dynamic";

/**
 * `/admin/settings` — currently just the "Muzik Latar" (background music)
 * panel. Analytics settings are Phase 7, not built here.
 */
export default async function AdminSettingsPage() {
  // Defense in depth: the `(protected)` layout already calls `requireAdmin()`,
  // but every page under it calls it again independently — never rely on
  // the layout's call alone.
  await requireAdmin();

  const [tracks, activeSetting] = await Promise.all([listMusicTracks(), getActiveMusicSetting()]);

  // Mirrors `getActiveMusicSrc`'s own resolution (src/db/queries/public.ts):
  // an unset row defaults to "preset", same as the public invite does.
  const activeValue = activeSetting ?? "preset";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-2xl text-brown-deep">Tetapan</h1>

      <MusicSettings
        tracks={tracks}
        activeValue={activeValue}
        presetMusicPath={wedding.presetMusicPath}
      />
    </div>
  );
}
