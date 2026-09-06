import { describe, expect, it } from "vitest";

import { sendMailjetEmail } from "./mailjet";

/**
 * These run with no Cloudflare Workers context available at all (plain
 * Vitest, no `getCloudflareContext` binding set up) — exactly the
 * "secrets missing" state `getSecret` hits, which is exactly what we want
 * to exercise: `sendMailjetEmail` must degrade to `{ ok: false, reason:
 * "unconfigured" }` rather than throwing, with no network call attempted.
 */
describe("sendMailjetEmail (unconfigured)", () => {
  it("never throws and reports 'unconfigured' when secrets are absent", async () => {
    const result = await sendMailjetEmail({
      to: ["someone@example.com"],
      subject: "Test",
      textPart: "test",
      htmlPart: "<p>test</p>",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unconfigured");
    }
  });
});
