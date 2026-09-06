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
    expect(shouldSendNotification(config())).toBe(false);
  });

  it("is false when disabled even with recipients configured", () => {
    expect(shouldSendNotification(config({ enabled: false, recipients: ["a@example.com"] }))).toBe(
      false,
    );
  });

  it("is false when enabled but no recipients — there is nobody to send to", () => {
    expect(shouldSendNotification(config({ enabled: true, recipients: [] }))).toBe(false);
  });

  it("is true when enabled with at least one recipient", () => {
    expect(shouldSendNotification(config({ enabled: true, recipients: ["a@example.com"] }))).toBe(
      true,
    );
  });

  it("is true with the maximum two recipients", () => {
    const c = config({ enabled: true, recipients: ["a@example.com", "b@example.com"] });
    expect(shouldSendNotification(c)).toBe(true);
  });
});
