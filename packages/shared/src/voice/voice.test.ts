import { describe, expect, it } from "vitest";
import { createSentenceSplitter, speakable } from "./index.js";

const stream = (chunks: string[]) => {
  const s = createSentenceSplitter();
  const spoken = chunks.flatMap((c) => s.push(c));
  return [...spoken, ...s.flush()];
};

describe("speakable", () => {
  it("drops what only works on a screen", () => {
    expect(speakable("**Nice** work 💪\n- walk at 7\n[Added: Walk]")).toBe("Nice work walk at 7");
  });
});

describe("the sentence splitter", () => {
  it("speaks each sentence as soon as it's complete", () => {
    const s = createSentenceSplitter();
    expect(s.push("July in Houston is no joke, so")).toEqual([]);
    expect(s.push(" let's dodge the heat. How about ")).toEqual(["July in Houston is no joke, so let's dodge the heat."]);
    expect(s.push("6:30 before work?")).toEqual([]);
    expect(s.flush()).toEqual(["How about 6:30 before work?"]);
  });

  it("joins a short opener onto the next sentence", () => {
    expect(stream(["Hey. ", "Good to hear from you today. ", "What's up?"])).toEqual([
      "Hey. Good to hear from you today.",
      "What's up?",
    ]);
  });

  it("doesn't split decimals or times", () => {
    expect(stream(["You walked 2.5 miles by 7:30, which is great. Keep going."])).toEqual([
      "You walked 2.5 miles by 7:30, which is great.",
      "Keep going.",
    ]);
  });

  it("loses nothing however the text is chunked", () => {
    const text = "First thing, drink some water. Then ten push-ups after coffee! Does that work for you?";
    const byChar = stream(text.split(""));
    expect(byChar.join(" ")).toBe(text);
  });
});
