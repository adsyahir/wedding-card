import { describe, expect, it } from "vitest";

import { DEFAULT_NOTIFICATIONS, type NotificationsConfig } from "./wedding-config";

import { escapeHtml, shouldSendNotification } from "./notify";

describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Ahmad bin Ali")).toBe("Ahmad bin Ali");
  });

  it("handles an empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("neutralizes a guest name crafted to break out of the HTML body", () => {
    const malicious = `<img src=x onerror=alert(1)>`;
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
  });
});

describe("shouldSendNotification", () => {
  function config(overrides: Partial<NotificationsConfig> = {}): NotificationsConfig {
    return { ...DEFAULT_NOTIFICATIONS, ...overrides };
  }

  it("is false by default (disabled, no recipients)", () => {
    expect(shouldSendNotification(config(), "rsvp")).toBe(false);
    expect(shouldSendNotification(config(), "ucapan")).toBe(false);
  });

  it("is false when disabled even with recipients configured", () => {
    const c = config({ enabled: false, recipients: ["a@example.com"] });
    expect(shouldSendNotification(c, "rsvp")).toBe(false);
  });

  it("is false when enabled but no recipients", () => {
    const c = config({ enabled: true, recipients: [] });
    expect(shouldSendNotification(c, "rsvp")).toBe(false);
  });

  it("is true when enabled, recipients configured, and the event flag is on", () => {
    const c = config({ enabled: true, recipients: ["a@example.com"], onRsvp: true });
    expect(shouldSendNotification(c, "rsvp")).toBe(true);
  });

  it("is false for rsvp when onRsvp is off, independent of onUcapan", () => {
    const c = config({ enabled: true, recipients: ["a@example.com"], onRsvp: false, onUcapan: true });
    expect(shouldSendNotification(c, "rsvp")).toBe(false);
    expect(shouldSendNotification(c, "ucapan")).toBe(true);
  });

  it("is false for ucapan when onUcapan is off, independent of onRsvp", () => {
    const c = config({ enabled: true, recipients: ["a@example.com"], onRsvp: true, onUcapan: false });
    expect(shouldSendNotification(c, "ucapan")).toBe(false);
    expect(shouldSendNotification(c, "rsvp")).toBe(true);
  });
});
