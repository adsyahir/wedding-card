import { wedding } from "@/config/wedding";
import { getActiveMusicSetting, listGalleryImagesForAdmin, listMusicTracks } from "@/db/queries/admin";
import { requireAdmin } from "@/lib/auth";
import { getAdminDict, getAdminLang } from "@/lib/i18n/admin";
import { getWeddingConfig } from "@/lib/wedding-config";

import { GallerySettings } from "../_components/GallerySettings";
import { MusicSettings } from "../_components/MusicSettings";
import { NotificationSettings } from "../_components/NotificationSettings";
import { WeddingConfigSettings } from "../_components/WeddingConfigSettings";

// Never statically optimized/cached — every request must actually run the
// guard below and fetch fresh data.
export const dynamic = "force-dynamic";

/**
 * `/admin/settings` — one tab strip over every settings panel.
 *
 * Galeri, Muzik and Notifikasi are passed in as extra tabs rather than
 * rendered underneath: as siblings below the strip they showed on every
 * tab at once, which made the tabs look broken.
 */
export default async function AdminSettingsPage() {
  // Defense in depth: the `(protected)` layout already calls `requireAdmin()`,
  // but every page under it calls it again independently — never rely on
  // the layout's call alone.
  await requireAdmin();

  const lang = await getAdminLang();
  const dict = getAdminDict(lang);

  const [tracks, activeSetting, config, galleryImages] = await Promise.all([
    listMusicTracks(),
    getActiveMusicSetting(),
    getWeddingConfig(),
    listGalleryImagesForAdmin(),
  ]);

  // Mirrors `getActiveMusicSrc`'s own resolution (src/db/queries/public.ts):
  // an unset row defaults to "preset", same as the public invite does.
  const activeValue = activeSetting ?? "preset";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-serif text-2xl text-brown-deep">{dict.settings_heading}</h1>

      <WeddingConfigSettings
        initialConfig={config}
        dict={dict}
        extraTabs={[
          {
            id: "galeri",
            label: dict.gallery_heading,
            content: <GallerySettings images={galleryImages} dict={dict} lang={lang} />,
          },
          {
            id: "muzik",
            label: dict.music_heading,
            content: (
              <MusicSettings
                tracks={tracks}
                activeValue={activeValue}
                presetMusicPath={wedding.presetMusicPath}
                dict={dict}
                lang={lang}
              />
            ),
          },
          {
            id: "notifikasi",
            label: dict.notif_heading,
            content: <NotificationSettings initialConfig={config.notifications} dict={dict} />,
          },
        ]}
      />
    </div>
  );
}
