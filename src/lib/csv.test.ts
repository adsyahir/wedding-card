import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("prepends a UTF-8 BOM", () => {
    const csv = toCsv(["a"], [["1"]]);
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it("joins headers and rows with commas and CRLF line endings", () => {
    const csv = toCsv(["name", "phone"], [["Ali", "0123456789"]]);
    expect(csv).toBe(`${BOM}name,phone\r\nAli,0123456789`);
  });

  it("renders null cells as empty strings", () => {
    const csv = toCsv(["message"], [[null]]);
    expect(csv).toBe(`${BOM}message\r\n`);
  });

  it("renders numbers", () => {
    const csv = toCsv(["adults"], [[3]]);
    expect(csv).toBe(`${BOM}adults\r\n3`);
  });

  describe("CSV injection mitigation", () => {
    for (const trigger of ["=", "+", "-", "@"]) {
      it(`prefixes a cell starting with "${trigger}" with a single quote`, () => {
        const csv = toCsv(["name"], [[`${trigger}HYPERLINK("http://evil")`]]);
        const dataLine = csv.split("\r\n")[1];
        expect(dataLine.startsWith(`"'${trigger}`)).toBe(true);
      });
    }

    it("prefixes a cell starting with a tab", () => {
      const csv = toCsv(["name"], [["\tcmd"]]);
      const dataLine = csv.split("\r\n")[1];
      expect(dataLine.startsWith("'\t")).toBe(true);
    });

    it("prefixes a cell starting with a carriage return", () => {
      const csv = toCsv(["name"], [["\rcmd"]]);
      const dataLine = csv.split("\r\n")[1];
      // The cell now contains a CR, so it's also RFC 4180-quoted.
      expect(dataLine).toBe(`"'\rcmd"`);
    });

    it("neutralizes the classic DDE/formula injection payload", () => {
      const payload = "=cmd|'/c calc'!A1";
      const csv = toCsv(["name"], [[payload]]);
      const dataLine = csv.split("\r\n")[1];
      // No comma/double-quote/newline in this payload, so it's guarded but
      // not RFC 4180-quoted.
      expect(dataLine).toBe(`'${payload}`);
      // Never emitted verbatim without the guard prefix.
      expect(dataLine).not.toBe(payload);
    });

    it("does not touch a cell that merely contains, but doesn't start with, a trigger char", () => {
      const csv = toCsv(["name"], [["Ali = the best"]]);
      const dataLine = csv.split("\r\n")[1];
      expect(dataLine).toBe("Ali = the best");
    });
  });

  describe("RFC 4180 quoting", () => {
    it("quotes a cell containing a comma", () => {
      const csv = toCsv(["name"], [["Ali, bin Abu"]]);
      expect(csv.split("\r\n")[1]).toBe('"Ali, bin Abu"');
    });

    it("quotes and doubles inner quotes for a cell containing a quote", () => {
      const csv = toCsv(["name"], [['Ali "the man" Abu']]);
      expect(csv.split("\r\n")[1]).toBe('"Ali ""the man"" Abu"');
    });

    it("quotes a cell containing a newline", () => {
      const csv = toCsv(["message"], [["line one\nline two"]]);
      expect(csv.split("\r\n")[1]).toBe('"line one\nline two"');
    });

    it("handles a name containing a comma, a quote, and a newline together", () => {
      const name = 'Ali, "Abu"\nbin Hassan';
      const csv = toCsv(["name"], [[name]]);
      expect(csv.split("\r\n").slice(1).join("\r\n")).toBe('"Ali, ""Abu""\nbin Hassan"');
    });

    it("round-trips a Malay name with emoji", () => {
      const name = "Nur Aisyah 🌸 binti Ahmad";
      const csv = toCsv(["name"], [[name]]);
      expect(csv.split("\r\n")[1]).toBe(name);
    });
  });
});
