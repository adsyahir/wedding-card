/**
 * Hand-rolled, dependency-free User-Agent parsing for the analytics beacon.
 *
 * Deliberately has NO `server-only` import — every function here is a pure
 * string -> value transform with no DB/request access, so it's unit-testable
 * on its own and safe to import from either side.
 *
 * This is NOT a general-purpose UA parser. It only detects the handful of
 * cases that matter for a Malaysian wedding invite shared over WhatsApp:
 * most guests arrive from a WhatsApp forward, opened in WhatsApp's in-app
 * browser, on a phone. Getting that one case right matters far more than
 * covering every desktop browser under the sun.
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

export type ParsedUserAgent = {
  deviceType: DeviceType;
  os: string;
  browser: string;
};

/**
 * Detects the operating system. Order matters: `Android` must be checked
 * before `Linux` (every Android UA also contains the substring "Linux"),
 * and `iOS` devices (iPhone/iPad/iPod) are checked before anything else
 * since they can otherwise be mistaken for `macOS` ("like Mac OS X" appears
 * in every iOS UA).
 */
function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Lain";
}

/**
 * Detects the browser, with in-app browsers checked FIRST.
 *
 * WhatsApp/Facebook/Instagram's in-app browsers wrap the device's real
 * browser engine (WebView on Android, SFSafariViewController/WKWebView on
 * iOS) and append their own token to the end of an otherwise perfectly
 * normal Chrome/Safari UA string — e.g.
 * `"...Mobile Safari/537.36 WhatsApp/2.21.12.21"`. If Chrome/Safari were
 * checked first, every one of these would be misclassified as plain Chrome
 * or Safari — exactly backwards for a card whose traffic is overwhelmingly
 * WhatsApp forwards, which is the whole reason this distinction exists.
 *
 * Similarly, Edge and Samsung Internet both embed a real `Chrome/` (and
 * `Safari/`) token in their own UA, so they're checked before the generic
 * Chrome/Safari fallbacks. Chrome and Firefox on iOS identify themselves via
 * `CriOS/` / `FxiOS/` rather than `Chrome/` / `Firefox/`.
 */
function detectBrowser(ua: string): string {
  if (/WhatsApp/i.test(ua)) return "WhatsApp";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/Edg(A|iOS)?\//i.test(ua)) return "Edge";
  if (/SamsungBrowser\//i.test(ua)) return "Samsung Internet";
  if (/CriOS\//i.test(ua)) return "Chrome";
  if (/FxiOS\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return "Safari";
  return "Lain";
}

/** Tablet: iPad, or an Android device whose UA omits the `Mobile` token. */
function detectDeviceType(ua: string): DeviceType {
  if (/iPad/i.test(ua)) return "tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "tablet";
  if (/Mobile|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

/** Parses a raw `User-Agent` header into the small set of fields we store. Never throws, including on `""`. */
export function parseUserAgent(ua: string): ParsedUserAgent {
  const s = ua ?? "";
  return {
    deviceType: detectDeviceType(s),
    os: detectOs(s),
    browser: detectBrowser(s),
  };
}

/**
 * Conservative bot/crawler/tooling detection.
 *
 * Special case: `WhatsApp` appears in TWO very different kinds of request —
 * WhatsApp's own link-preview fetcher (a bot, used to build the little
 * preview card shown in a chat) sends a bare, minimal UA like
 * `"WhatsApp/2.23.20.79 A"`, with no `Mozilla`/`Safari` browser tokens at
 * all. WhatsApp's in-app browser (a real person tapping the link) wraps a
 * genuine mobile browser engine, so its UA looks like a normal
 * Chrome/Safari UA with `WhatsApp/x.y` appended at the end. Treating every
 * UA containing "whatsapp" as a bot would silently discard most of this
 * card's real traffic, which is the one mistake this function must not
 * make — so a `whatsapp` match is only a bot when the rest of the UA does
 * NOT look like a real browser.
 */
export function isBot(ua: string): boolean {
  const s = (ua ?? "").toLowerCase();
  if (!s) return false;

  if (s.includes("whatsapp")) {
    const looksLikeBrowser = s.includes("mozilla") && (s.includes("safari") || s.includes("mobile"));
    return !looksLikeBrowser;
  }

  const BOT_SUBSTRINGS = [
    "bot",
    "crawl",
    "spider",
    "slurp",
    "bingpreview",
    "facebookexternalhit",
    "telegrambot",
    "preview",
    "headless",
    "lighthouse",
    "pingdom",
    "curl",
    "wget",
    "python-requests",
    "axios",
    "go-http-client",
  ];

  return BOT_SUBSTRINGS.some((needle) => s.includes(needle));
}
