import { describe, expect, it } from "vitest";

import { isBot, parseUserAgent } from "./user-agent";

const UA = {
  chromeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  safariIpad:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  chromeAndroidPhone:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  chromeAndroidTablet:
    "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  edgeWindows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
  edgeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 EdgA/119.0.0.0",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
  firefoxIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/119.0 Mobile/15E148 Safari/605.1.15",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1",
  samsungInternet:
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
  facebookInAppAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/111.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/441.0.0.0.34;]",
  facebookInAppIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,5;FBAV/441.0.0.34.109]",
  instagramInAppIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 302.0.0.23.114 (iPhone14,5; iOS 17_0; en_US; en-US; scale=3.00; 1170x2532; 498423704)",
  whatsappInAppAndroid:
    "Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36 WhatsApp/2.21.12.21",
  whatsappInAppIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/23.20.79",
  whatsappLinkPreviewFetcher: "WhatsApp/2.23.20.79 A",
  facebookExternalHit: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  bingpreview: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) BingPreview/1.0b",
  telegramBot: "TelegramBot (like TwitterBot)",
  curl: "curl/8.4.0",
  wget: "Wget/1.21.3",
  pythonRequests: "python-requests/2.31.0",
  axios: "axios/1.6.0",
  goHttpClient: "Go-http-client/1.1",
  headlessChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36",
  lighthouse:
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
  pingdom: "Mozilla/5.0 (compatible; PingdomTMS/1.0)",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
} as const;

describe("parseUserAgent", () => {
  it("handles an empty string without throwing", () => {
    expect(() => parseUserAgent("")).not.toThrow();
    const result = parseUserAgent("");
    expect(result).toEqual({ deviceType: "desktop", os: "Lain", browser: "Lain" });
  });

  describe("OS detection", () => {
    it("detects iOS", () => {
      expect(parseUserAgent(UA.safariIphone).os).toBe("iOS");
      expect(parseUserAgent(UA.safariIpad).os).toBe("iOS");
    });

    it("detects Android", () => {
      expect(parseUserAgent(UA.chromeAndroidPhone).os).toBe("Android");
    });

    it("detects Windows", () => {
      expect(parseUserAgent(UA.chromeWindows).os).toBe("Windows");
    });

    it("detects macOS", () => {
      expect(parseUserAgent(UA.safariMac).os).toBe("macOS");
    });

    it("detects Linux (and not Android)", () => {
      expect(parseUserAgent(UA.linuxFirefox).os).toBe("Linux");
    });

    it("falls back to Lain for an unrecognized OS", () => {
      expect(parseUserAgent("SomeExoticOS/1.0").os).toBe("Lain");
    });
  });

  describe("browser detection", () => {
    it("detects the WhatsApp in-app browser ahead of the Chrome/Safari tokens it also carries", () => {
      expect(parseUserAgent(UA.whatsappInAppAndroid).browser).toBe("WhatsApp");
      expect(parseUserAgent(UA.whatsappInAppIos).browser).toBe("WhatsApp");
    });

    it("detects the Facebook in-app browser via FBAN/FBAV", () => {
      expect(parseUserAgent(UA.facebookInAppAndroid).browser).toBe("Facebook");
      expect(parseUserAgent(UA.facebookInAppIos).browser).toBe("Facebook");
    });

    it("detects the Instagram in-app browser", () => {
      expect(parseUserAgent(UA.instagramInAppIos).browser).toBe("Instagram");
    });

    it("detects Edge ahead of Chrome on both desktop and Android", () => {
      expect(parseUserAgent(UA.edgeWindows).browser).toBe("Edge");
      expect(parseUserAgent(UA.edgeAndroid).browser).toBe("Edge");
    });

    it("detects Samsung Internet ahead of Chrome", () => {
      expect(parseUserAgent(UA.samsungInternet).browser).toBe("Samsung Internet");
    });

    it("detects Chrome on desktop and Android", () => {
      expect(parseUserAgent(UA.chromeWindows).browser).toBe("Chrome");
      expect(parseUserAgent(UA.chromeAndroidPhone).browser).toBe("Chrome");
    });

    it("detects Chrome on iOS via the CriOS token", () => {
      expect(parseUserAgent(UA.chromeIos).browser).toBe("Chrome");
    });

    it("detects Safari on macOS and iOS", () => {
      expect(parseUserAgent(UA.safariMac).browser).toBe("Safari");
      expect(parseUserAgent(UA.safariIphone).browser).toBe("Safari");
    });

    it("detects Firefox on desktop and via the FxiOS token on iOS", () => {
      expect(parseUserAgent(UA.firefoxWindows).browser).toBe("Firefox");
      expect(parseUserAgent(UA.firefoxIos).browser).toBe("Firefox");
    });

    it("falls back to Lain for an unrecognized browser", () => {
      expect(parseUserAgent("SomeExoticBrowser/1.0").browser).toBe("Lain");
    });
  });

  describe("device type detection", () => {
    it("detects mobile for phones", () => {
      expect(parseUserAgent(UA.safariIphone).deviceType).toBe("mobile");
      expect(parseUserAgent(UA.chromeAndroidPhone).deviceType).toBe("mobile");
    });

    it("detects tablet for iPad", () => {
      expect(parseUserAgent(UA.safariIpad).deviceType).toBe("tablet");
    });

    it("detects tablet for an Android UA lacking the Mobile token", () => {
      expect(parseUserAgent(UA.chromeAndroidTablet).deviceType).toBe("tablet");
    });

    it("detects desktop for a plain desktop UA", () => {
      expect(parseUserAgent(UA.chromeWindows).deviceType).toBe("desktop");
      expect(parseUserAgent(UA.safariMac).deviceType).toBe("desktop");
      expect(parseUserAgent(UA.linuxFirefox).deviceType).toBe("desktop");
    });
  });
});

describe("isBot", () => {
  it("returns false for an empty string", () => {
    expect(isBot("")).toBe(false);
  });

  it("returns false for ordinary desktop and mobile browsers", () => {
    expect(isBot(UA.chromeWindows)).toBe(false);
    expect(isBot(UA.safariMac)).toBe(false);
    expect(isBot(UA.safariIphone)).toBe(false);
    expect(isBot(UA.chromeAndroidPhone)).toBe(false);
    expect(isBot(UA.edgeWindows)).toBe(false);
    expect(isBot(UA.firefoxWindows)).toBe(false);
    expect(isBot(UA.samsungInternet)).toBe(false);
  });

  it("returns false for the Facebook and Instagram in-app browsers (real people)", () => {
    expect(isBot(UA.facebookInAppAndroid)).toBe(false);
    expect(isBot(UA.facebookInAppIos)).toBe(false);
    expect(isBot(UA.instagramInAppIos)).toBe(false);
  });

  it("returns true for facebookexternalhit (the Facebook link-preview crawler)", () => {
    expect(isBot(UA.facebookExternalHit)).toBe(true);
  });

  // This is the nuance the whole module exists to get right: the WhatsApp
  // in-app browser (a real guest, tapping a forwarded link) must NEVER be
  // classified as a bot, even though its UA contains the same "WhatsApp"
  // substring as the link-preview fetcher (which must be).
  it("returns false for the WhatsApp in-app browser (a real guest)", () => {
    expect(isBot(UA.whatsappInAppAndroid)).toBe(false);
    expect(isBot(UA.whatsappInAppIos)).toBe(false);
  });

  it("returns true for WhatsApp's link-preview fetcher", () => {
    expect(isBot(UA.whatsappLinkPreviewFetcher)).toBe(true);
  });

  it("returns true for well-known crawlers/tools", () => {
    expect(isBot(UA.googlebot)).toBe(true);
    expect(isBot(UA.bingpreview)).toBe(true);
    expect(isBot(UA.telegramBot)).toBe(true);
    expect(isBot(UA.curl)).toBe(true);
    expect(isBot(UA.wget)).toBe(true);
    expect(isBot(UA.pythonRequests)).toBe(true);
    expect(isBot(UA.axios)).toBe(true);
    expect(isBot(UA.goHttpClient)).toBe(true);
    expect(isBot(UA.headlessChrome)).toBe(true);
    expect(isBot(UA.lighthouse)).toBe(true);
    expect(isBot(UA.pingdom)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBot("CURL/8.4.0")).toBe(true);
    expect(isBot("Mozilla/5.0 GOOGLEBOT/2.1")).toBe(true);
  });
});
