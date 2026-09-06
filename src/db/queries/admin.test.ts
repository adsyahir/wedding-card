import { describe, expect, it } from "vitest";

import { isValidGalleryReorder, resolvePagination, resolveSort } from "./admin";

describe("resolveSort", () => {
  it("defaults to createdAt/desc when nothing is supplied", () => {
    expect(resolveSort({})).toEqual({ sort: "createdAt", direction: "desc" });
  });

  it("accepts each whitelisted sort field", () => {
    expect(resolveSort({ sort: "name" }).sort).toBe("name");
    expect(resolveSort({ sort: "adults" }).sort).toBe("adults");
    expect(resolveSort({ sort: "createdAt" }).sort).toBe("createdAt");
  });

  it("accepts asc/desc direction", () => {
    expect(resolveSort({ direction: "asc" }).direction).toBe("asc");
    expect(resolveSort({ direction: "desc" }).direction).toBe("desc");
  });

  it("falls back to the default sort field for an arbitrary string, rather than passing it through", () => {
    expect(resolveSort({ sort: "phone; DROP TABLE rsvps" }).sort).toBe("createdAt");
    expect(resolveSort({ sort: "" }).sort).toBe("createdAt");
    expect(resolveSort({ sort: undefined }).sort).toBe("createdAt");
  });

  it("falls back to the default direction for an arbitrary string", () => {
    expect(resolveSort({ direction: "sideways" }).direction).toBe("desc");
    expect(resolveSort({ direction: "" }).direction).toBe("desc");
  });

  it("resolves sort and direction independently", () => {
    expect(resolveSort({ sort: "name", direction: "asc" })).toEqual({
      sort: "name",
      direction: "asc",
    });
    expect(resolveSort({ sort: "bogus", direction: "asc" })).toEqual({
      sort: "createdAt",
      direction: "asc",
    });
  });
});

describe("resolvePagination", () => {
  it("defaults to page 1, 25 per page", () => {
    expect(resolvePagination({})).toEqual({ page: 1, perPage: 25 });
  });

  it("clamps page < 1 up to 1", () => {
    expect(resolvePagination({ page: 0 }).page).toBe(1);
    expect(resolvePagination({ page: -5 }).page).toBe(1);
  });

  it("clamps perPage > 100 down to 100", () => {
    expect(resolvePagination({ perPage: 500 }).perPage).toBe(100);
  });

  it("falls back to the default perPage when perPage < 1", () => {
    expect(resolvePagination({ perPage: 0 }).perPage).toBe(25);
    expect(resolvePagination({ perPage: -1 }).perPage).toBe(25);
  });

  it("falls back to defaults for non-finite input", () => {
    expect(resolvePagination({ page: Number.NaN, perPage: Number.NaN })).toEqual({
      page: 1,
      perPage: 25,
    });
  });

  it("accepts an in-range page/perPage unchanged", () => {
    expect(resolvePagination({ page: 3, perPage: 50 })).toEqual({ page: 3, perPage: 50 });
  });

  it("floors a fractional page/perPage", () => {
    expect(resolvePagination({ page: 2.9, perPage: 10.9 })).toEqual({ page: 2, perPage: 10 });
  });
});

describe("isValidGalleryReorder", () => {
  it("accepts a full reordering of the same set", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("accepts the identity ordering", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
  });

  it("accepts an empty gallery reordered to an empty list", () => {
    expect(isValidGalleryReorder([], [])).toBe(true);
  });

  it("rejects a list missing an id (omission)", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("rejects a list with an extra foreign id (addition)", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["a", "b", "c", "z"])).toBe(false);
  });

  it("rejects a list containing an id not in the current set at all", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["a", "b", "z"])).toBe(false);
  });

  it("rejects a list with a duplicated id", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
  });

  it("rejects when lengths differ even if every requested id is valid", () => {
    expect(isValidGalleryReorder(["a", "b", "c"], ["a", "b", "c", "a"])).toBe(false);
  });
});
