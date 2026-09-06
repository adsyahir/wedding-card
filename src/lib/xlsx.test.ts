import { describe, expect, it } from "vitest";

import { buildXlsx, columnName } from "./xlsx";

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

function asText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe("columnName", () => {
  it("maps indices to spreadsheet letters", () => {
    expect(columnName(0)).toBe("A");
    expect(columnName(25)).toBe("Z");
    expect(columnName(26)).toBe("AA");
    expect(columnName(27)).toBe("AB");
    expect(columnName(51)).toBe("AZ");
  });
});

describe("buildXlsx", () => {
  const headers = ["Nama", "Telefon"];
  const rows = [["Ali bin Ahmad", "+60123456789"]];

  it("produces something that starts with the ZIP magic bytes", () => {
    const out = buildXlsx(headers, rows);
    expect(Array.from(out.slice(0, 4))).toEqual(ZIP_MAGIC);
  });

  it("contains the five parts a workbook needs", () => {
    const text = asText(buildXlsx(headers, rows));
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("writes the cell values", () => {
    const text = asText(buildXlsx(headers, rows));
    expect(text).toContain("Ali bin Ahmad");
    expect(text).toContain("+60123456789");
  });

  // The reason this format is preferred over CSV for untrusted names.
  it("writes every cell as an inline string, so a formula can never execute", () => {
    const text = asText(buildXlsx(["Nama"], [["=cmd|'/c calc'!A1"]]));
    expect(text).toContain('t="inlineStr"');
    // Present as literal text, and never as a formula element.
    expect(text).toContain("=cmd|&apos;/c calc&apos;!A1");
    expect(text).not.toContain("<f>");
  });

  it("escapes XML metacharacters rather than corrupting the sheet", () => {
    const text = asText(buildXlsx(["Nama"], [['Golf & Co <script> "x"']]));
    expect(text).toContain("Golf &amp; Co &lt;script&gt; &quot;x&quot;");
  });

  it("skips empty cells instead of emitting empty elements", () => {
    const text = asText(buildXlsx(["A", "B"], [["", "value"]]));
    expect(text).toContain('r="B2"');
    expect(text).not.toContain('r="A2"');
  });

  it("names the sheet, truncating to Excel's 31-character limit", () => {
    const text = asText(buildXlsx(["A"], [["x"]], "A very long sheet name that Excel will not accept"));
    const match = /name="([^"]*)"/.exec(text);
    expect(match?.[1].length).toBeLessThanOrEqual(31);
  });

  it("drops control characters that would make the workbook unopenable", () => {
    const text = asText(buildXlsx(["Nama"], [["Ali\u0000\u0007bin Ahmad"]]));
    // The name survives with the control characters removed. (Checking the
    // whole archive for \u0000 would be meaningless — ZIP headers are full
    // of null bytes; what matters is that none reach the sheet XML.)
    expect(text).toContain("Alibin Ahmad");
    const sheet = text.slice(text.indexOf("<sheetData>"), text.indexOf("</sheetData>"));
    expect(sheet).not.toContain("\u0000");
    expect(sheet).not.toContain("\u0007");
  });
});
