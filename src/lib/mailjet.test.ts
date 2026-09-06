import { describe, expect, it } from "vitest";

import { messageStatusError, sendMailjetEmail } from "./mailjet";

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

/*
 * These exist because of a real miss: Mailjet answered HTTP 200 for a send
 * with an unvalidated `From:`, the client reported success, and the mail
 * was never delivered. HTTP status alone is not delivery.
 */
describe("messageStatusError", () => {
  it("accepts a body where every message succeeded", () => {
    expect(
      messageStatusError({ Messages: [{ Status: "success" }, { Status: "success" }] }),
    ).toBeNull();
  });

  it("reports a per-message error returned under HTTP 200", () => {
    const problem = messageStatusError({
      Messages: [
        {
          Status: "error",
          Errors: [{ ErrorMessage: '"test@example.com" is not an allowed sender.' }],
        },
      ],
    });
    expect(problem).toContain("not an allowed sender");
  });

  it("reports a partial failure when only one recipient was refused", () => {
    const problem = messageStatusError({
      Messages: [{ Status: "success" }, { Status: "error", Errors: [{ ErrorMessage: "bad" }] }],
    });
    expect(problem).toBe("bad");
  });

  it("falls back to the raw status when Mailjet gives no error text", () => {
    expect(messageStatusError({ Messages: [{ Status: "queued" }] })).toContain("queued");
  });

  it("treats an unparseable body as failure, never as success", () => {
    expect(messageStatusError(null)).not.toBeNull();
    expect(messageStatusError("nonsense")).not.toBeNull();
    expect(messageStatusError({})).not.toBeNull();
    expect(messageStatusError({ Messages: [] })).not.toBeNull();
  });
});
