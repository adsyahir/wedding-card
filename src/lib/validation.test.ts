import { describe, expect, it } from "vitest";

import {
  MAX_NAME_LEN,
  MAX_RSVP_MESSAGE_LEN,
  MAX_WISH_MESSAGE_LEN,
  MIN_NAME_LEN,
  MIN_WISH_MESSAGE_LEN,
  normalizeMalaysianPhone,
  rsvpSchema,
  wishSchema,
} from "./validation";

function validRsvp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Ahmad bin Ismail",
    phone: "012-345 6789",
    attending: true,
    adults: 2,
    children: 0,
    website: "",
    ...overrides,
  };
}

function validWish(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ahmad bin Ismail",
    message: "Selamat pengantin baru!",
    website: "",
    ...overrides,
  };
}

describe("normalizeMalaysianPhone", () => {
  it("normalizes a dashed/spaced local number", () => {
    expect(normalizeMalaysianPhone("012-345 6789")).toBe("+60123456789");
  });

  it("normalizes a plain local number", () => {
    expect(normalizeMalaysianPhone("0123456789")).toBe("+60123456789");
  });

  it("normalizes an E.164 number with plus", () => {
    expect(normalizeMalaysianPhone("+60123456789")).toBe("+60123456789");
  });

  it("normalizes an international number without plus", () => {
    expect(normalizeMalaysianPhone("60123456789")).toBe("+60123456789");
  });

  it("normalizes a longer 011-prefixed number", () => {
    expect(normalizeMalaysianPhone("011-1234 5678")).toBe("+601112345678");
  });

  it("rejects a non-mobile local number", () => {
    expect(normalizeMalaysianPhone("03-1234 5678")).toBeNull();
  });

  it("rejects a too-short number", () => {
    expect(normalizeMalaysianPhone("0123")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(normalizeMalaysianPhone("not a phone number")).toBeNull();
  });
});

describe("rsvpSchema", () => {
  it("accepts a valid RSVP and normalizes the phone", () => {
    const result = rsvpSchema.safeParse(validRsvp());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("+60123456789");
    }
  });

  it("rejects an invalid phone number", () => {
    const result = rsvpSchema.safeParse(validRsvp({ phone: "not a phone" }));
    expect(result.success).toBe(false);
  });

  it("rejects a name below the minimum length", () => {
    const result = rsvpSchema.safeParse(validRsvp({ name: "A".repeat(MIN_NAME_LEN - 1) }));
    expect(result.success).toBe(false);
  });

  it("accepts a name at the minimum length boundary", () => {
    const result = rsvpSchema.safeParse(validRsvp({ name: "A".repeat(MIN_NAME_LEN) }));
    expect(result.success).toBe(true);
  });

  it("rejects a name above the maximum length", () => {
    const result = rsvpSchema.safeParse(validRsvp({ name: "A".repeat(MAX_NAME_LEN + 1) }));
    expect(result.success).toBe(false);
  });

  it("accepts a name at the maximum length boundary", () => {
    const result = rsvpSchema.safeParse(validRsvp({ name: "A".repeat(MAX_NAME_LEN) }));
    expect(result.success).toBe(true);
  });

  it("rejects adults below the minimum", () => {
    const result = rsvpSchema.safeParse(validRsvp({ adults: 0 }));
    expect(result.success).toBe(false);
  });

  it("rejects adults above the maximum", () => {
    const result = rsvpSchema.safeParse(validRsvp({ adults: 11 }));
    expect(result.success).toBe(false);
  });

  it("rejects a message over the maximum length", () => {
    const result = rsvpSchema.safeParse(
      validRsvp({ message: "a".repeat(MAX_RSVP_MESSAGE_LEN + 1) }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a message at the maximum length boundary", () => {
    const result = rsvpSchema.safeParse(validRsvp({ message: "a".repeat(MAX_RSVP_MESSAGE_LEN) }));
    expect(result.success).toBe(true);
  });

  it("accepts a missing (optional) message", () => {
    // validRsvp() never includes a `message` key unless explicitly overridden.
    const result = rsvpSchema.safeParse(validRsvp());
    expect(result.success).toBe(true);
  });

  it("rejects a non-empty honeypot field", () => {
    const result = rsvpSchema.safeParse(validRsvp({ website: "http://spam.example" }));
    expect(result.success).toBe(false);
  });

  it("accepts a missing honeypot field, defaulting to empty", () => {
    const withoutWebsite = validRsvp();
    delete withoutWebsite.website;
    const result = rsvpSchema.safeParse(withoutWebsite);
    expect(result.success).toBe(true);
  });

  it("rejects control characters in the name", () => {
    const result = rsvpSchema.safeParse(validRsvp({ name: "Ahmad\x00Ismail" }));
    expect(result.success).toBe(false);
  });

  it("rejects control characters in the message", () => {
    const result = rsvpSchema.safeParse(validRsvp({ message: "Hello\x07World" }));
    expect(result.success).toBe(false);
  });

  it("allows newlines in the message", () => {
    const result = rsvpSchema.safeParse(validRsvp({ message: "Line one\nLine two" }));
    expect(result.success).toBe(true);
  });
});

describe("wishSchema", () => {
  it("accepts a valid wish", () => {
    const result = wishSchema.safeParse(validWish());
    expect(result.success).toBe(true);
  });

  it("rejects a message below the minimum length", () => {
    const result = wishSchema.safeParse(validWish({ message: "a".repeat(MIN_WISH_MESSAGE_LEN - 1) }));
    expect(result.success).toBe(false);
  });

  it("accepts a message at the minimum length boundary", () => {
    const result = wishSchema.safeParse(validWish({ message: "a".repeat(MIN_WISH_MESSAGE_LEN) }));
    expect(result.success).toBe(true);
  });

  it("rejects a message above the maximum length", () => {
    const result = wishSchema.safeParse(
      validWish({ message: "a".repeat(MAX_WISH_MESSAGE_LEN + 1) }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a message at the maximum length boundary", () => {
    const result = wishSchema.safeParse(validWish({ message: "a".repeat(MAX_WISH_MESSAGE_LEN) }));
    expect(result.success).toBe(true);
  });

  it("rejects a non-empty honeypot field", () => {
    const result = wishSchema.safeParse(validWish({ website: "http://spam.example" }));
    expect(result.success).toBe(false);
  });

  it("rejects control characters in the message", () => {
    const result = wishSchema.safeParse(validWish({ message: "Congrats\x1Fto you" }));
    expect(result.success).toBe(false);
  });

  it("allows newlines in the message", () => {
    const result = wishSchema.safeParse(validWish({ message: "Congrats!\nAll the best." }));
    expect(result.success).toBe(true);
  });
});

describe("normalizeMalaysianPhone — prefix range", () => {
  it("rejects the unassigned 015 range", () => {
    // The whole point of `[0-46-9]`: 015 is not an assigned mobile prefix,
    // so it is a typo rather than a number, and better caught here than
    // discovered when nobody answers.
    expect(normalizeMalaysianPhone("0151234567")).toBeNull();
    expect(normalizeMalaysianPhone("+60151234567")).toBeNull();
  });

  it("accepts every assigned prefix around it", () => {
    for (const p of ["010", "011", "012", "013", "014", "016", "017", "018", "019"]) {
      expect(normalizeMalaysianPhone(`${p}1234567`)).not.toBeNull();
    }
  });

  it("accepts the three shapes people type and normalises them to one", () => {
    const expected = "+60123456789";
    expect(normalizeMalaysianPhone("0123456789")).toBe(expected);
    expect(normalizeMalaysianPhone("60123456789")).toBe(expected);
    expect(normalizeMalaysianPhone("+60123456789")).toBe(expected);
    expect(normalizeMalaysianPhone("012-345 6789")).toBe(expected);
    expect(normalizeMalaysianPhone("012.345.6789")).toBe(expected);
  });

  it("rejects too short and too long", () => {
    expect(normalizeMalaysianPhone("012345")).toBeNull();
    expect(normalizeMalaysianPhone("01234567890123")).toBeNull();
  });
});
