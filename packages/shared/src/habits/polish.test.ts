import { describe, expect, it } from "vitest";
import { basicTidy, displayFields, needsPolish, parsePolish } from "./index.js";

describe("basicTidy", () => {
  it("cleans up typing without changing what it says", () => {
    expect(basicTidy("  after i get my coffee or whatever  ")).toBe("After I get my coffee");
    expect(basicTidy("um like i want to feel less stressed lol")).toBe("I want to feel less stressed");
    expect(basicTidy("im tired of being tired!!!")).toBe("I'm tired of being tired!");
    expect(basicTidy("")).toBe("");
    expect(basicTidy(null)).toBe("");
  });

  it("leaves already-clean text alone", () => {
    expect(basicTidy("After I pour my coffee")).toBe("After I pour my coffee");
  });
});

describe("displayFields", () => {
  const raw = {
    cue: "after i get my coffe or whatever",
    response: "2 pushups",
    craving: "honestly im so lazy and i hate it",
    backupPlan: null,
  };
  const aiPolish = {
    source: "ai",
    cue: "After I pour my coffee",
    response: "2 push-ups",
    craving: "To feel like I'm keeping a promise to myself",
    of: { cue: raw.cue, response: raw.response, craving: raw.craving },
  };

  it("shows the AI's reading when it matches the current text", () => {
    const d = displayFields({ ...raw, polished: aiPolish });
    expect(d).toMatchObject({
      cue: "After I pour my coffee",
      craving: "To feel like I'm keeping a promise to myself",
      backupPlan: "",
    });
    expect(d.polishedByAi).toEqual(["cue", "response", "craving"]);
  });

  it("falls back to a basic tidy for a field edited since", () => {
    const d = displayFields({ ...raw, cue: "when i get home", polished: aiPolish });
    expect(d.cue).toBe("When I get home");
    expect(d.polishedByAi).not.toContain("cue");
  });

  it("hides a why that was flagged as distress", () => {
    const d = displayFields({ ...raw, polished: { ...aiPolish, concern: true } });
    expect(d.craving).toBe("");
    expect(d.concern).toBe(true);
  });

  it("works with no polish at all", () => {
    expect(displayFields(raw).cue).toBe("After I get my coffe");
  });
});

describe("needsPolish", () => {
  it("is true until the AI has read the current text", () => {
    expect(needsPolish({ cue: "after lunch" })).toBe(true);
    expect(needsPolish({ cue: "after lunch", polished: { source: "ai", cue: "After lunch", of: { cue: "after lunch" } } })).toBe(false);
    expect(needsPolish({ cue: "after dinner", polished: { source: "ai", cue: "After lunch", of: { cue: "after lunch" } } })).toBe(true);
    expect(needsPolish({})).toBe(false);
  });

  it("reads junk in the column as no polish", () => {
    expect(parsePolish("nonsense")).toBeNull();
    expect(parsePolish({ cue: 4, of: null })).toMatchObject({ of: {}, source: "basic" });
  });
});
