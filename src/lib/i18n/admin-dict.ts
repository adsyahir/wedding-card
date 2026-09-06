/**
 * Client-safe half of the admin dashboard's i18n setup: the dictionary
 * itself, the cookie name/validation, and the interpolation helper. NO
 * `server-only` import here (deliberately) — client components (e.g. the
 * language toggle, and the client-only admin error boundary which can't
 * receive a dict prop from its parent) need `parseAdminLang`/`getAdminDict`
 * too. The one piece that genuinely needs the server (`next/headers`) is
 * `getAdminLang()`, factored into `src/lib/i18n/admin.ts` instead.
 *
 * Admin dashboard language preference (Bahasa Melayu / English).
 *
 * WHY A COOKIE, NOT A DATABASE COLUMN: several family members may share one
 * admin login (see `scripts/seed-admin.mjs` / README — there is no
 * per-person admin account model). A cookie gives each of them their own
 * language on their own device/browser; a column on `admin_users` would
 * force one single choice on everyone sharing that one account, and would
 * need a migration to add. A cookie needs neither.
 *
 * This preference is UI-only and NOT security-sensitive (unlike the
 * session/CSRF cookies in `src/lib/session.ts`): it only ever selects which
 * string table to render from, never anything privileged. So it does NOT
 * use the `__Host-` prefix (reserved in this codebase for the session and
 * CSRF cookies) and is deliberately readable by client JS (no `httpOnly`) —
 * the toggle sets it directly via `document.cookie`.
 */
export const ADMIN_LANG_COOKIE_NAME = "wc_admin_lang";

/** One year, in seconds. */
export const ADMIN_LANG_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type AdminLang = "ms" | "en";

const VALID_LANGS: readonly AdminLang[] = ["ms", "en"];

/**
 * Never trust the raw cookie value: it is validated against the fixed set
 * `["ms", "en"]` and anything else (missing, empty, garbage, or something
 * adversarial like `"__proto__"`) falls back to `"ms"`. This value is used
 * to select a dictionary key below — accepting an unvalidated value here
 * would be a bug waiting to happen (e.g. prototype-pollution-flavoured
 * lookups if this ever fed an object index built some other way).
 */
export function parseAdminLang(value: string | null | undefined): AdminLang {
  return VALID_LANGS.includes(value as AdminLang) ? (value as AdminLang) : "ms";
}

/**
 * The flat admin-dashboard string table. Bahasa Melayu (`ms`) is the base
 * object; English (`en`) is typed as `Record<keyof typeof ms, string>` so a
 * key present in one but missing in the other is a TYPE ERROR, not a
 * silently-blank string in the UI. See `src/lib/i18n/admin.test.ts` for a
 * runtime assertion of the same thing (belt and braces: the type check
 * only helps while editing this file, the test protects against any future
 * mechanism that could bypass it, e.g. a stray `as any`).
 *
 * Keys are grouped by the part of the admin UI they belong to, matching
 * the component/page that consumes them (see the comment above each
 * group). `{placeholder}` tokens are filled in by `interpolate()` below.
 */
const ms = {
  // Nav (src/app/admin/(protected)/AdminNav.tsx)
  nav_ringkasan: "Ringkasan",
  nav_rsvp: "RSVP",
  nav_ucapan: "Ucapan",
  nav_analitik: "Analitik",
  nav_tetapan: "Tetapan",

  // Logout button (src/app/admin/(protected)/LogoutButton.tsx)
  logout_action: "Log Keluar",
  logout_pending: "Log keluar…",

  // Admin error boundary (src/app/admin/(protected)/error.tsx)
  errorBoundary_title: "Maaf, berlaku ralat.",
  errorBoundary_message:
    "Halaman pentadbiran ini gagal dimuatkan. Sila cuba sekali lagi, atau log masuk semula jika masalah berterusan.",
  errorBoundary_retry: "Cuba Lagi",

  // Login page (src/app/admin/login/{page,LoginForm}.tsx)
  login_title: "Log Masuk Admin",
  login_subtitle: "Panel pentadbiran kad jemputan",
  login_usernameLabel: "Nama Pengguna",
  login_passwordLabel: "Kata Laluan",
  login_submit: "Log Masuk",
  login_submitting: "Log Masuk…",

  // Shared across many client components
  common_unexpectedError: "Ralat tidak dijangka. Sila cuba lagi.",
  common_networkError: "Ralat rangkaian. Sila cuba lagi.",
  common_save: "Simpan",
  common_saving: "Menyimpan...",
  common_saved: "Berjaya disimpan.",
  common_delete: "Padam",
  common_cancel: "Batal",
  common_upload: "Muat Naik",
  common_uploading: "Memuat naik...",
  common_prev: "← Sebelum",
  common_next: "Seterusnya →",
  common_pageLabel: "Muka {page} / {total}",

  // Dashboard overview (src/app/admin/(protected)/page.tsx)
  dashboard_heading: "Ringkasan",
  dashboard_statHadir: "Hadir",
  dashboard_statTidakHadir: "Tidak Hadir",
  dashboard_statJumlahDewasa: "Jumlah Dewasa",
  dashboard_statJumlahKanakKanak: "Jumlah Kanak-Kanak",
  dashboard_statJumlahPax: "Jumlah Pax",
  dashboard_statUcapanMenunggu: "Ucapan Menunggu",
  dashboard_recentWishesHeading: "Ucapan terkini menunggu semakan",
  dashboard_viewAll: "Lihat semua",
  dashboard_emptyPending: "Tiada ucapan menunggu semakan.",

  // Wish moderation actions (src/app/admin/(protected)/_components/WishActions.tsx)
  wishActions_approve: "Luluskan",
  wishActions_reject: "Tolak",
  wishActions_delete: "Padam",
  wishActions_confirmDelete: "Padam ucapan ini? Tindakan ini tidak boleh dibatalkan.",

  // RSVP page (src/app/admin/(protected)/rsvp/page.tsx)
  rsvp_heading: "RSVP",
  rsvp_downloadCsv: "Muat Turun CSV",
  rsvp_searchPlaceholder: "Cari nama atau telefon…",
  rsvp_filterAll: "Semua",
  rsvp_filterHadir: "Hadir",
  rsvp_filterTidak: "Tidak Hadir",
  rsvp_filterSubmit: "Tapis",
  rsvp_recordCount: "{n} rekod",
  rsvp_colName: "Nama",
  rsvp_colPhone: "Telefon",
  rsvp_colAttending: "Kehadiran",
  rsvp_colAdults: "Dewasa",
  rsvp_colChildren: "Kanak-Kanak",
  rsvp_colPax: "Pax",
  rsvp_colMessage: "Pesanan",
  rsvp_colDate: "Tarikh",
  rsvp_emptyState: "Tiada rekod RSVP dijumpai.",
  rsvp_deleteAction: "Padam",
  rsvp_deleteConfirm: "Sahkan padam?",

  // RSVP CSV export (src/app/api/admin/rsvp/export/route.ts headers)
  rsvpExport_colName: "Nama",
  rsvpExport_colPhone: "Telefon",
  rsvpExport_colAttending: "Kehadiran",
  rsvpExport_colAdults: "Dewasa",
  rsvpExport_colChildren: "Kanak-Kanak",
  rsvpExport_colMessage: "Pesanan",
  rsvpExport_colDate: "Tarikh",
  rsvpExport_hadir: "Hadir",
  rsvpExport_tidakHadir: "Tidak Hadir",

  // Ucapan moderation queue (src/app/admin/(protected)/ucapan/page.tsx)
  ucapan_heading: "Ucapan",
  ucapan_noticeBefore: "Hanya ucapan berstatus",
  ucapan_noticeStatus: "Diluluskan",
  ucapan_noticeAfter:
    "dipaparkan di laman jemputan awam. Ucapan yang menunggu semakan tidak kelihatan kepada tetamu.",
  ucapan_tabPending: "Menunggu",
  ucapan_tabApproved: "Diluluskan",
  ucapan_tabRejected: "Ditolak",
  ucapan_recordCount: "{n} rekod",
  ucapan_emptyState: "Tiada ucapan dalam kategori ini.",
  ucapan_sentAt: "Dihantar {date}",
  ucapan_reviewedAt: " · Disemak {date}",

  // Analytics (src/app/admin/(protected)/analytics/{page,VisitsChart}.tsx)
  analytics_heading: "Analitik",
  analytics_range7: "7 hari",
  analytics_range30: "30 hari",
  analytics_range90: "90 hari",
  analytics_statViews: "Jumlah Lawatan",
  analytics_statUniques: "Pelawat Unik",
  analytics_statRsvpOpen: "RSVP Dibuka",
  analytics_statRsvpSubmit: "RSVP Dihantar",
  analytics_chartHeading: "Lawatan mengikut hari",
  analytics_chartEmpty: "Tiada data lawatan lagi untuk tempoh ini.",
  analytics_chartTooltipDay: "Hari: {day}",
  analytics_chartSeriesViews: "Lawatan",
  analytics_chartSeriesUniques: "Pelawat unik",
  analytics_panelCountries: "Negara teratas",
  analytics_panelCities: "Bandar teratas",
  analytics_emptyCountries: "Tiada data negara lagi.",
  analytics_emptyCities: "Tiada data bandar lagi.",
  analytics_panelReferrer: "Sumber rujukan (referrer)",
  analytics_emptyReferrer: "Tiada data rujukan lagi.",
  analytics_panelDevice: "Peranti",
  analytics_emptyDevice: "Tiada data peranti lagi.",
  analytics_panelOs: "Sistem operasi",
  analytics_emptyOs: "Tiada data sistem operasi lagi.",
  analytics_panelBrowser: "Pelayar",
  analytics_emptyBrowser: "Tiada data pelayar lagi.",
  analytics_deviceMobile: "Mudah alih",
  analytics_deviceTablet: "Tablet",
  analytics_deviceDesktop: "Desktop",
  analytics_panelFunnel: "Corong penglibatan RSVP",
  analytics_funnelViews: "Lawatan",
  analytics_funnelRsvpOpen: "RSVP dibuka",
  analytics_funnelRsvpSubmit: "RSVP dihantar",

  // Settings page shell (src/app/admin/(protected)/settings/page.tsx)
  settings_heading: "Tetapan",

  // Wedding config settings (src/app/admin/(protected)/_components/WeddingConfigSettings.tsx)
  wc_heading: "Kandungan Kad Jemputan",
  wc_overriddenBadge: "Menggunakan tetapan admin",
  wc_resetButton: "Kembalikan ke asal",
  wc_resetting: "Memulihkan...",
  wc_resetConfirm:
    "Kembalikan semua tetapan kad jemputan kepada nilai asal fail (src/config/wedding.ts)? Tindakan ini tidak boleh dibatalkan.",
  wc_tabsAriaLabel: "Tetapan kad jemputan",
  wc_tabButiran: "Butiran",
  wc_tabLokasi: "Lokasi",
  wc_tabAturCara: "Atur Cara",
  wc_tabHubungi: "Hubungi",
  wc_tabBahagian: "Bahagian",

  wc_eventType: "Jenis Majlis",
  wc_hashtag: "Hashtag",
  wc_groomShort: "Nama Pendek Pengantin Lelaki",
  wc_groomFull: "Nama Penuh Pengantin Lelaki",
  wc_brideShort: "Nama Pendek Pengantin Perempuan",
  wc_brideFull: "Nama Penuh Pengantin Perempuan",
  wc_eventDate: "Tarikh Majlis",
  wc_startTime: "Masa Mula",
  wc_endTimeOfDay: "Masa Tamat",
  wc_rsvpDeadlineDate: "Tarikh Tutup RSVP",
  wc_previewHeading: "Papar pada kad:",
  wc_previewEnds: "Tamat",
  wc_previewDeadline: "Tutup RSVP",
  wc_hostsLine: "Baris Tuan Rumah",
  wc_hostsNames: "Nama Ibu Bapa (satu baris setiap satu)",
  wc_salam: "Salam",
  wc_honorifics: "Gelaran Jemputan",
  wc_invitationBody: "Teks Jemputan (perenggan dipisah baris kosong)",
  wc_doa: "Doa Penutup",
  wc_scriptFontLabel: "Fon Skrip (nama, tempat, hashtag)",
  wc_scriptFontPreview: "Pratonton:",
  wc_scriptFont_parisienne: "Parisienne",
  wc_scriptFont_greatVibes: "Great Vibes",
  wc_scriptFont_dancingScript: "Dancing Script",
  wc_scriptFont_sacramento: "Sacramento",
  wc_scriptFont_cormorantGaramond: "Cormorant Garamond",

  wc_venueName: "Nama Tempat",
  wc_venueAddress: "Alamat (satu baris setiap satu)",
  wc_venueLat: "Latitud",
  wc_venueLng: "Longitud",
  wc_venueGmaps: "Pautan Google Maps (https, google.com/goo.gl)",
  wc_venueWaze: "Pautan Waze (https, waze.com)",

  wc_aturCaraTimePlaceholder: "Masa",
  wc_aturCaraLabelPlaceholder: "Perkara",
  wc_addRow: "+ Tambah Baris",
  wc_moveUp: "Alih ke atas",
  wc_moveDown: "Alih ke bawah",

  wc_contactNamePlaceholder: "Nama",
  wc_contactRolePlaceholder: "Peranan",
  wc_contactPhonePlaceholder: "Telefon",
  wc_addContact: "+ Tambah Kenalan",

  wc_sectionsNotice:
    'Menutup bahagian "RSVP" atau "Ucapan" juga menyekat penghantaran borang berkaitan di pelayan — bukan sekadar menyembunyikannya.',
  wc_sectionUndangan: "Bahagian Undangan",
  wc_sectionLokasi: "Bahagian Lokasi",
  wc_sectionAturCara: "Bahagian Atur Cara",
  wc_sectionCountdown: "Bahagian Menghitung Hari",
  wc_sectionGaleri: "Bahagian Galeri",
  wc_sectionUcapan: "Bahagian Ucapan (dinding + borang)",
  wc_sectionKehadiran: "Bahagian Kehadiran (tallies)",
  wc_sectionKalendarGrid: "Grid kalendar dalam helaian Kalendar",
  wc_sectionPetaEmbed: "Peta terbenam dalam Lokasi",
  wc_petaEmbedPrivacyNotice:
    "Lalai dimatikan dengan sengaja: membenamkan Google Maps bermakna Google menerima alamat IP setiap tetamu yang membuka kad jemputan ini — kos privasi yang perlu dipilih oleh pasangan, bukan diwarisi.",
  wc_navKalendar: "Nav: Kalendar",
  wc_navLokasi: "Nav: Lokasi",
  wc_navHubungi: "Nav: Hubungi",
  wc_navRsvp: "Nav: RSVP (juga menutup penghantaran RSVP)",
  wc_paxModeLabel: "Cara tanya jumlah kehadiran",
  wc_siteModeLabel: "Status kad jemputan",
  wc_siteModeLive: "Aktif — tetamu boleh melihat kad",
  wc_siteModeMaintenance: "Penyelenggaraan — kad ditutup sementara",
  wc_siteModeEnded: "Majlis tamat — kad ditutup",
  wc_siteClosedMessageLabel: "Mesej untuk tetamu (pilihan)",
  wc_siteClosedMessagePlaceholder: "Biarkan kosong untuk mesej lalai.",
  wc_siteModeWarning: "Kad akan digantikan dengan notis ini, dan RSVP serta ucapan tidak lagi boleh dihantar.",
  wc_paxModeNotice: "Hanya ditanya kepada tetamu yang memilih Hadir.",
  wc_paxModeAdultsChildren: "Asingkan dewasa dan kanak-kanak",
  wc_paxModeTotal: "Satu jumlah sahaja (cth. 3 orang)",
  wc_paxModeNone: "Jangan tanya (nama, telefon dan ucapan sahaja)",

  // Music settings (src/app/admin/(protected)/_components/MusicSettings.tsx)
  music_heading: "Muzik Latar",
  music_noMusic: "Tiada muzik",
  music_defaultSong: "Lagu lalai",
  music_noPresetWarning:
    "Tiada fail lagu lalai dibundel (`presetMusicPath` kosong dalam src/config/wedding.ts). Jika dipilih, tiada muzik akan dimainkan.",
  music_noTracksUploaded: "Belum ada trek dimuat naik.",
  music_deleteActiveTitle: "Tidak boleh memadam trek yang sedang aktif — tukar muzik dahulu",
  music_uploadHeading: "Muat naik trek baharu",
  music_labelFieldLabel: "Label (pilihan — lalai kepada nama fail)",
  music_labelPlaceholder: "cth. Lagu Cinta",
  music_selectAudioFile: "Sila pilih fail audio.",
  music_fileTooLarge: "Saiz fail terlalu besar (had 8 MB).",
  music_confirmDelete: "Padam trek muzik ini? Tindakan ini tidak boleh dibatalkan.",
  music_confirmDeleteActive: "Trek ini sedang digunakan. Memadamnya akan menutup muzik latar. Teruskan?",
  music_dropHint: "Seret fail ke sini, atau pilih fail:",

  // Gallery settings (src/app/admin/(protected)/_components/GallerySettings.tsx)
  gallery_heading: "Galeri",
  gallery_emptyState: "Belum ada gambar dimuat naik. Kad akan memaparkan gambar placeholder lalai.",
  gallery_altPlaceholder: "Teks alt",
  gallery_altEmptyError: "Teks alt tidak boleh kosong.",
  gallery_uploadHeading: "Muat naik gambar baharu ({remaining} baki daripada {max})",
  gallery_selectImageFile: "Sila pilih fail gambar.",
  gallery_unsupportedFormat: "Format fail tidak disokong. Gunakan JPEG, PNG atau WebP.",
  gallery_fileTooLarge: "Saiz fail terlalu besar (had 5 MB).",
  gallery_confirmDelete: "Padam gambar ini? Tindakan ini tidak boleh dibatalkan.",

  // Notification settings (src/app/admin/(protected)/_components/NotificationSettings.tsx)
  notif_heading: "Notifikasi",
  notif_secretsNotice:
    "Kelayakan Mailjet (kunci API, alamat penghantar) ditetapkan sebagai secret pelayan (`wrangler secret put`), bukan dari skrin ini. Jika e-mel ujian gagal dengan mesej \"belum dikonfigurasikan\", itu bermakna secret tersebut belum ditetapkan pada deployment ini.",
  notif_enable: "Aktifkan notifikasi e-mel",
  notif_recipientLabel: "Penerima {n}",
  notif_recipientPlaceholder: "nama@contoh.com",
  notif_testSend: "Hantar e-mel ujian",
  notif_testSending: "Menghantar…",
  notif_testSuccess: "E-mel ujian berjaya dihantar.",

  // Server error `code` → localized message (src/lib/api.ts's ADMIN_ERROR_CODES,
  // and a few route-specific fixed strings). Used by useAdminAction and the
  // other client mutation helpers to localize a failure without trusting
  // the server's (Malay) `error` string directly.
  errors_notFound: "Rekod tidak dijumpai.",
  errors_invalidInput: "Sila semak semula maklumat yang dimasukkan.",
  fieldErr_urlInvalid: "URL tidak sah",
  fieldErr_urlMustBeHttps: "URL mesti menggunakan https:",
  fieldErr_urlHostNotAllowed: "Hos URL tidak dibenarkan",
  fieldErr_phoneInvalid: "Nombor telefon Malaysia tidak sah",
  fieldErr_generic: "Nilai tidak sah",
  errors_invalidRequest: "Permintaan tidak sah.",
  errors_serverError: "Maaf, berlaku ralat. Sila cuba sebentar lagi.",
  errors_unsupportedMediaType: "Format fail tidak disokong.",
  errors_payloadTooLarge: "Saiz fail terlalu besar.",
  errors_tooManyRequests: "Terlalu banyak percubaan. Sila cuba sebentar lagi.",
  errors_galleryFull: "Galeri sudah penuh. Padam gambar sedia ada sebelum memuat naik lagi.",
  errors_invalidReorder: "Senarai gambar tidak sepadan dengan galeri semasa. Sila muat semula halaman.",
  errors_activeTrackConflict: "Trek ini sedang aktif. Tukar muzik dahulu sebelum memadam.",
  errors_invalidCredentials: "Nama pengguna atau kata laluan tidak sah.",
  errors_unauthorized: "Sesi tamat tempoh. Sila log masuk semula.",
  errors_forbidden: "Tindakan disekat.",
  fieldErr_emailInvalid: "Alamat e-mel tidak sah",
  errors_noRecipientsConfigured: "Sila konfigurasikan sekurang-kurangnya satu penerima dan simpan dahulu.",
  errors_mailjetUnconfigured:
    "Mailjet belum dikonfigurasikan pada pelayan (secrets hilang). Ini perlu ditetapkan dengan `wrangler secret put`, bukan dari skrin ini.",
  errors_mailjetRejected:
    "Mailjet menolak permintaan (contohnya alamat penghantar belum disahkan). Semak dashboard Mailjet anda.",
  errors_mailjetNetworkError: "Ralat rangkaian semasa menghubungi Mailjet. Sila cuba sebentar lagi.",
} as const;

const en: Record<keyof typeof ms, string> = {
  nav_ringkasan: "Overview",
  nav_rsvp: "RSVP",
  nav_ucapan: "Wishes",
  nav_analitik: "Analytics",
  nav_tetapan: "Settings",

  logout_action: "Log Out",
  logout_pending: "Logging out…",

  errorBoundary_title: "Sorry, something went wrong.",
  errorBoundary_message:
    "This admin page failed to load. Please try again, or log in again if the problem persists.",
  errorBoundary_retry: "Try Again",

  login_title: "Admin Login",
  login_subtitle: "Invitation card admin panel",
  login_usernameLabel: "Username",
  login_passwordLabel: "Password",
  login_submit: "Log In",
  login_submitting: "Logging in…",

  common_unexpectedError: "Unexpected error. Please try again.",
  common_networkError: "Network error. Please try again.",
  common_save: "Save",
  common_saving: "Saving...",
  common_saved: "Saved successfully.",
  common_delete: "Delete",
  common_cancel: "Cancel",
  common_upload: "Upload",
  common_uploading: "Uploading...",
  common_prev: "← Previous",
  common_next: "Next →",
  common_pageLabel: "Page {page} / {total}",

  dashboard_heading: "Overview",
  dashboard_statHadir: "Attending",
  dashboard_statTidakHadir: "Not Attending",
  dashboard_statJumlahDewasa: "Total Adults",
  dashboard_statJumlahKanakKanak: "Total Children",
  dashboard_statJumlahPax: "Total Pax",
  dashboard_statUcapanMenunggu: "Wishes Pending",
  dashboard_recentWishesHeading: "Recent wishes awaiting review",
  dashboard_viewAll: "View all",
  dashboard_emptyPending: "No wishes awaiting review.",

  wishActions_approve: "Approve",
  wishActions_reject: "Reject",
  wishActions_delete: "Delete",
  wishActions_confirmDelete: "Delete this wish? This action cannot be undone.",

  rsvp_heading: "RSVP",
  rsvp_downloadCsv: "Download CSV",
  rsvp_searchPlaceholder: "Search name or phone…",
  rsvp_filterAll: "All",
  rsvp_filterHadir: "Attending",
  rsvp_filterTidak: "Not Attending",
  rsvp_filterSubmit: "Filter",
  rsvp_recordCount: "{n} records",
  rsvp_colName: "Name",
  rsvp_colPhone: "Phone",
  rsvp_colAttending: "Attendance",
  rsvp_colAdults: "Adults",
  rsvp_colChildren: "Children",
  rsvp_colPax: "Pax",
  rsvp_colMessage: "Message",
  rsvp_colDate: "Date",
  rsvp_emptyState: "No RSVP records found.",
  rsvp_deleteAction: "Delete",
  rsvp_deleteConfirm: "Confirm delete?",

  rsvpExport_colName: "Name",
  rsvpExport_colPhone: "Phone",
  rsvpExport_colAttending: "Attendance",
  rsvpExport_colAdults: "Adults",
  rsvpExport_colChildren: "Children",
  rsvpExport_colMessage: "Message",
  rsvpExport_colDate: "Date",
  rsvpExport_hadir: "Attending",
  rsvpExport_tidakHadir: "Not Attending",

  ucapan_heading: "Wishes",
  ucapan_noticeBefore: "Only wishes with the status",
  ucapan_noticeStatus: "Approved",
  ucapan_noticeAfter:
    "are shown on the public invitation page. Wishes awaiting review are not visible to guests.",
  ucapan_tabPending: "Pending",
  ucapan_tabApproved: "Approved",
  ucapan_tabRejected: "Rejected",
  ucapan_recordCount: "{n} records",
  ucapan_emptyState: "No wishes in this category.",
  ucapan_sentAt: "Sent {date}",
  ucapan_reviewedAt: " · Reviewed {date}",

  analytics_heading: "Analytics",
  analytics_range7: "7 days",
  analytics_range30: "30 days",
  analytics_range90: "90 days",
  analytics_statViews: "Total Visits",
  analytics_statUniques: "Unique Visitors",
  analytics_statRsvpOpen: "RSVP Opened",
  analytics_statRsvpSubmit: "RSVP Submitted",
  analytics_chartHeading: "Visits by day",
  analytics_chartEmpty: "No visit data yet for this period.",
  analytics_chartTooltipDay: "Day: {day}",
  analytics_chartSeriesViews: "Visits",
  analytics_chartSeriesUniques: "Unique visitors",
  analytics_panelCountries: "Top countries",
  analytics_panelCities: "Top cities",
  analytics_emptyCountries: "No country data yet.",
  analytics_emptyCities: "No city data yet.",
  analytics_panelReferrer: "Referral sources (referrer)",
  analytics_emptyReferrer: "No referral data yet.",
  analytics_panelDevice: "Device",
  analytics_emptyDevice: "No device data yet.",
  analytics_panelOs: "Operating system",
  analytics_emptyOs: "No operating system data yet.",
  analytics_panelBrowser: "Browser",
  analytics_emptyBrowser: "No browser data yet.",
  analytics_deviceMobile: "Mobile",
  analytics_deviceTablet: "Tablet",
  analytics_deviceDesktop: "Desktop",
  analytics_panelFunnel: "RSVP engagement funnel",
  analytics_funnelViews: "Visits",
  analytics_funnelRsvpOpen: "RSVP opened",
  analytics_funnelRsvpSubmit: "RSVP submitted",

  settings_heading: "Settings",

  wc_heading: "Invitation Card Content",
  wc_overriddenBadge: "Using admin settings",
  wc_resetButton: "Restore to default",
  wc_resetting: "Restoring...",
  wc_resetConfirm:
    "Restore all invitation card settings to the file's original values (src/config/wedding.ts)? This action cannot be undone.",
  wc_tabsAriaLabel: "Invitation card settings",
  wc_tabButiran: "Details",
  wc_tabLokasi: "Location",
  wc_tabAturCara: "Itinerary",
  wc_tabHubungi: "Contact",
  wc_tabBahagian: "Sections",

  wc_eventType: "Event Type",
  wc_hashtag: "Hashtag",
  wc_groomShort: "Groom's Short Name",
  wc_groomFull: "Groom's Full Name",
  wc_brideShort: "Bride's Short Name",
  wc_brideFull: "Bride's Full Name",
  wc_eventDate: "Ceremony Date",
  wc_startTime: "Start Time",
  wc_endTimeOfDay: "End Time",
  wc_rsvpDeadlineDate: "RSVP Deadline",
  wc_previewHeading: "Shown on the card:",
  wc_previewEnds: "Ends",
  wc_previewDeadline: "RSVP closes",
  wc_hostsLine: "Hosts Line",
  wc_hostsNames: "Parents' Names (one per line)",
  wc_salam: "Greeting",
  wc_honorifics: "Guest Honorifics",
  wc_invitationBody: "Invitation Text (paragraphs separated by a blank line)",
  wc_doa: "Closing Prayer",
  wc_scriptFontLabel: "Script Font (names, venue, hashtag)",
  wc_scriptFontPreview: "Preview:",
  wc_scriptFont_parisienne: "Parisienne",
  wc_scriptFont_greatVibes: "Great Vibes",
  wc_scriptFont_dancingScript: "Dancing Script",
  wc_scriptFont_sacramento: "Sacramento",
  wc_scriptFont_cormorantGaramond: "Cormorant Garamond",

  wc_venueName: "Venue Name",
  wc_venueAddress: "Address (one line each)",
  wc_venueLat: "Latitude",
  wc_venueLng: "Longitude",
  wc_venueGmaps: "Google Maps Link (https, google.com/goo.gl)",
  wc_venueWaze: "Waze Link (https, waze.com)",

  wc_aturCaraTimePlaceholder: "Time",
  wc_aturCaraLabelPlaceholder: "Item",
  wc_addRow: "+ Add Row",
  wc_moveUp: "Move up",
  wc_moveDown: "Move down",

  wc_contactNamePlaceholder: "Name",
  wc_contactRolePlaceholder: "Role",
  wc_contactPhonePlaceholder: "Phone",
  wc_addContact: "+ Add Contact",

  wc_sectionsNotice:
    'Turning off the "RSVP" or "Wishes" section also blocks the related form submissions on the server — not just hiding them.',
  wc_sectionUndangan: "Invitation Section",
  wc_sectionLokasi: "Location Section",
  wc_sectionAturCara: "Itinerary Section",
  wc_sectionCountdown: "Countdown Section",
  wc_sectionGaleri: "Gallery Section",
  wc_sectionUcapan: "Wishes Section (wall + form)",
  wc_sectionKehadiran: "Attendance Section (tallies)",
  wc_sectionKalendarGrid: "Month grid inside the Calendar sheet",
  wc_sectionPetaEmbed: "Embedded map in Location",
  wc_petaEmbedPrivacyNotice:
    "Deliberately off by default: embedding Google Maps means Google receives the IP address of every guest who opens this invitation — a privacy cost the couple should opt into, not inherit.",
  wc_navKalendar: "Nav: Calendar",
  wc_navLokasi: "Nav: Location",
  wc_navHubungi: "Nav: Contact",
  wc_navRsvp: "Nav: RSVP (also blocks RSVP submission)",
  wc_paxModeLabel: "How to ask for headcount",
  wc_siteModeLabel: "Invitation status",
  wc_siteModeLive: "Live — guests can see the card",
  wc_siteModeMaintenance: "Maintenance — temporarily closed",
  wc_siteModeEnded: "Event ended — closed",
  wc_siteClosedMessageLabel: "Message for guests (optional)",
  wc_siteClosedMessagePlaceholder: "Leave blank for the default message.",
  wc_siteModeWarning: "The card will be replaced by this notice, and RSVPs and wishes can no longer be submitted.",
  wc_paxModeNotice: "Only asked of guests who choose Hadir.",
  wc_paxModeAdultsChildren: "Separate adults and children",
  wc_paxModeTotal: "A single total (e.g. 3 people)",
  wc_paxModeNone: "Do not ask (name, phone and wish only)",

  music_heading: "Background Music",
  music_noMusic: "No music",
  music_defaultSong: "Default song",
  music_noPresetWarning:
    "No default song file bundled (`presetMusicPath` is empty in src/config/wedding.ts). If selected, no music will play.",
  music_noTracksUploaded: "No tracks uploaded yet.",
  music_deleteActiveTitle: "Can't delete the currently active track — switch music first",
  music_uploadHeading: "Upload a new track",
  music_labelFieldLabel: "Label (optional — defaults to the file name)",
  music_labelPlaceholder: "e.g. Love Song",
  music_selectAudioFile: "Please select an audio file.",
  music_fileTooLarge: "File is too large (8 MB limit).",
  music_confirmDelete: "Delete this music track? This action cannot be undone.",
  music_confirmDeleteActive: "This track is currently in use. Deleting it will turn the background music off. Continue?",
  music_dropHint: "Drag a file here, or choose one:",

  gallery_heading: "Gallery",
  gallery_emptyState: "No photos uploaded yet. The card will show a default placeholder image.",
  gallery_altPlaceholder: "Alt text",
  gallery_altEmptyError: "Alt text cannot be empty.",
  gallery_uploadHeading: "Upload a new photo ({remaining} of {max} remaining)",
  gallery_selectImageFile: "Please select an image file.",
  gallery_unsupportedFormat: "Unsupported file format. Use JPEG, PNG or WebP.",
  gallery_fileTooLarge: "File is too large (5 MB limit).",
  gallery_confirmDelete: "Delete this photo? This action cannot be undone.",

  notif_heading: "Notifications",
  notif_secretsNotice:
    "Mailjet credentials (API key, sender address) are set as server secrets (`wrangler secret put`), not from this screen. If the test email fails with an \"unconfigured\" message, those secrets haven't been set on this deployment yet.",
  notif_enable: "Enable email notifications",
  notif_recipientLabel: "Recipient {n}",
  notif_recipientPlaceholder: "name@example.com",
  notif_testSend: "Send test email",
  notif_testSending: "Sending…",
  notif_testSuccess: "Test email sent successfully.",

  errors_notFound: "Record not found.",
  errors_invalidInput: "Please review the information you entered.",
  fieldErr_urlInvalid: "Not a valid URL",
  fieldErr_urlMustBeHttps: "URL must use https:",
  fieldErr_urlHostNotAllowed: "URL host is not allowed",
  fieldErr_phoneInvalid: "Not a valid Malaysian phone number",
  fieldErr_generic: "Invalid value",
  errors_invalidRequest: "Invalid request.",
  errors_serverError: "Sorry, an error occurred. Please try again shortly.",
  errors_unsupportedMediaType: "Unsupported file format.",
  errors_payloadTooLarge: "File is too large.",
  errors_tooManyRequests: "Too many attempts. Please try again shortly.",
  errors_galleryFull: "Gallery is full. Delete existing photos before uploading more.",
  errors_invalidReorder: "The photo list doesn't match the current gallery. Please reload the page.",
  errors_activeTrackConflict: "This track is currently active. Switch music before deleting it.",
  errors_invalidCredentials: "Invalid username or password.",
  errors_unauthorized: "Session expired. Please log in again.",
  errors_forbidden: "Action forbidden.",
  fieldErr_emailInvalid: "Not a valid email address",
  errors_noRecipientsConfigured: "Please configure at least one recipient and save first.",
  errors_mailjetUnconfigured:
    "Mailjet isn't configured on the server (secrets missing). This needs to be set with `wrangler secret put`, not from this screen.",
  errors_mailjetRejected:
    "Mailjet rejected the request (e.g. an unvalidated sender address). Check your Mailjet dashboard.",
  errors_mailjetNetworkError: "Network error contacting Mailjet. Please try again shortly.",
};

const DICTS = { ms, en } satisfies Record<AdminLang, Record<string, string>>;

/** All keys in the admin dictionary — used for the dictionary-parity test. */
export type AdminDictKey = keyof typeof ms;

/** The resolved flat string table type handed down to client components as a plain prop. */
export type AdminDict = Record<AdminDictKey, string>;

/** Returns the resolved flat dictionary for `lang`. Safe to call from client or server code. */
export function getAdminDict(lang: AdminLang): AdminDict {
  return DICTS[lang];
}

/**
 * Tiny `{token}` interpolation helper — no i18n library, just enough for
 * the handful of strings above that need one (record counts, page
 * numbers, remaining-upload-slot counts, ...). Unknown tokens are left
 * as-is rather than throwing.
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}
