import { describe, expect, it } from "vitest";
import { EQUIPMENT_OPTIONS } from "../constants/index.js";
import { accessOptionsFor } from "./access.js";

describe("accessOptionsFor", () => {
  it("asks about gym kit for someone becoming stronger", () => {
    expect(accessOptionsFor("someone who trains", [])).toEqual(expect.arrayContaining([...EQUIPMENT_OPTIONS]));
  });

  it("asks about quiet and a notebook, not kettlebells, for a calmer person", () => {
    const options = accessOptionsFor("a calmer parent who journals", ["Reduce stress"]);
    expect(options).toContain("A journal or notebook");
    expect(options).not.toContain("Kettlebell");
  });

  it("follows the identity first, then the goals", () => {
    const options = accessOptionsFor("a writer who finishes things", ["Get stronger"]);
    expect(options.indexOf("A laptop or tablet")).toBeLessThan(options.indexOf("Dumbbells"));
  });

  it("falls back to a general list and never repeats", () => {
    const options = accessOptionsFor("zzz", []);
    expect(options.length).toBeGreaterThan(3);
    expect(new Set(options).size).toBe(options.length);
  });
});
