import { describe, expect, it, vi } from "vitest";
import { TOPIC_OPTION_COUNT, TOPIC_THEMES, seededRng, topicKeyFor } from "@kinextion/shared";
import { PROMPT_BANK } from "./prompt-bank";
import { rhythmGuidance, selectOptions, type CandidateOption } from "./rhythm";
import {
  FACILITATOR_SYSTEM_PROMPT,
  buildSynthesisMessage,
  parseGeneratedOptions,
  synthesizeTopics,
} from "./synthesize";

const SUGGESTIONS = [
  "dating apps and whether they're making things worse",
  "pressure from family to get married young",
  "is it weird to meet people through church now",
  "social media and comparing relationships",
  "how dating was different ten years ago",
  "should you date someone who doesn't share your faith",
  "friends who disappear when they get into a relationship",
  "is it ok to be single for a long time on purpose",
  "work taking over everything",
  "money arguments in relationships",
  "whether ambition and contentment can coexist",
  "screen time with kids",
];

const model = (options: Array<{ text: string; theme: string; rationale: string }>) =>
  vi.fn().mockResolvedValue({ options });

const good = [
  { text: "Should Christians use dating apps?", theme: "relationships", rationale: "Several of you have been thinking about how people meet now." },
  { text: "Is there too much pressure to marry young?", theme: "family", rationale: "A few of you mentioned expectations from home." },
  { text: "Has social media made dating harder?", theme: "relationships", rationale: "Comparison came up more than once." },
  { text: "Can ambition and contentment live together?", theme: "growth", rationale: "Work and enough came up in different ways." },
  { text: "Is being single on purpose undervalued?", theme: "identity", rationale: "Some of you raised choosing your own pace." },
  { text: "Do money arguments say more about values than money?", theme: "money", rationale: "Money in relationships came up." },
];

describe("synthesizeTopics", () => {
  it("returns exactly four options from a healthy set of suggestions", async () => {
    const generate = model(good);
    const result = await synthesizeTopics({
      communityName: "Favour House",
      suggestions: SUGGESTIONS,
      recentTopics: [],
      generate,
      rng: seededRng(1),
    });
    expect(result.source).toBe("synthesized");
    expect(result.options).toHaveLength(TOPIC_OPTION_COUNT);
    expect(result.options[0].text).toBe("Should Christians use dating apps?");
    expect(new Set(result.options.map((o) => topicKeyFor(o.text))).size).toBe(TOPIC_OPTION_COUNT);
  });

  it("never repeats one of the last weeks' questions", async () => {
    const result = await synthesizeTopics({
      communityName: "Favour House",
      suggestions: SUGGESTIONS,
      recentTopics: [{ text: "Should Christians use dating apps?", theme: "relationships" }],
      generate: model(good),
      rng: seededRng(1),
    });
    expect(result.options.map((o) => o.text)).not.toContain("Should Christians use dating apps?");
    expect(result.options).toHaveLength(TOPIC_OPTION_COUNT);
  });

  it("uses the prompt bank below the suggestion threshold, without calling a model", async () => {
    const generate = model(good);
    const result = await synthesizeTopics({
      communityName: "Quiet Group",
      suggestions: ["one thing", "another thing"],
      recentTopics: [],
      generate,
      rng: seededRng(2),
    });
    expect(generate).not.toHaveBeenCalled();
    expect(result.source).toBe("bank");
    expect(result.options).toHaveLength(TOPIC_OPTION_COUNT);
    const bankTexts = new Set(PROMPT_BANK.map((p) => p.text));
    expect(result.options.every((o) => bankTexts.has(o.text))).toBe(true);
  });

  it("falls back to the bank when the model fails, rather than leaving a week without a topic", async () => {
    const result = await synthesizeTopics({
      communityName: "Favour House",
      suggestions: SUGGESTIONS,
      recentTopics: [],
      generate: vi.fn().mockRejectedValue(new Error("overloaded")),
      rng: seededRng(3),
    });
    expect(result.source).toBe("fallback");
    expect(result.options).toHaveLength(TOPIC_OPTION_COUNT);
  });

  it("tops up a thin or partly invalid response to a full ballot", async () => {
    const result = await synthesizeTopics({
      communityName: "Favour House",
      suggestions: SUGGESTIONS,
      recentTopics: [],
      generate: model([
        good[0],
        { text: "not a question", theme: "work", rationale: "x" },
        { text: "Is this a real theme?", theme: "politics", rationale: "x" },
      ]),
      rng: seededRng(4),
    });
    expect(result.source).toBe("synthesized");
    expect(result.options).toHaveLength(TOPIC_OPTION_COUNT);
    expect(result.options[0].text).toBe(good[0].text);
  });

  it("is reproducible for a seed", async () => {
    const run = () =>
      synthesizeTopics({ communityName: "X", suggestions: [], recentTopics: [], rng: seededRng(9) });
    expect((await run()).options).toEqual((await run()).options);
  });

  it("sends the model suggestions and recent topics, never anything identifying", async () => {
    const generate = model(good);
    await synthesizeTopics({
      communityName: "Favour House",
      suggestions: SUGGESTIONS,
      recentTopics: [{ text: "What does rest look like for you?", theme: "work" }],
      generate,
      rng: seededRng(1),
    });
    const request = generate.mock.calls[0][0];
    expect(request.system).toBe(FACILITATOR_SYSTEM_PROMPT);
    expect(request.user).toContain("dating apps");
    expect(request.user).toContain("What does rest look like for you?");
    // The generator only ever receives text — no ids, no names, no user fields.
    expect(Object.keys(request).sort()).toEqual(["schema", "system", "user"]);
  });
});

describe("the facilitator prompt", () => {
  it("holds the lines that matter", () => {
    expect(FACILITATOR_SYSTEM_PROMPT).toMatch(/never to decide what it believes/i);
    expect(FACILITATOR_SYSTEM_PROMPT).toMatch(/virality/i);
    expect(FACILITATOR_SYSTEM_PROMPT).toMatch(/Name, describe or hint at who suggested/);
    expect(FACILITATOR_SYSTEM_PROMPT).toMatch(/Invent news events/);
    expect(FACILITATOR_SYSTEM_PROMPT).toMatch(/distress/);
  });

  it("passes rhythm guidance into the request", () => {
    const message = buildSynthesisMessage({
      communityName: "Favour House",
      suggestions: ["a", "b", "c"],
      recentTopics: [],
      guidance: { avoid: ["relationships"], lean: "lighter" },
    });
    expect(message).toMatch(/relationships several weeks running/);
    expect(message).toMatch(/at least one option is lighter/);
  });

  it("mentions what members are building, without names, and only when there is something", () => {
    const base = { communityName: "Favour House", suggestions: ["a", "b", "c"], recentTopics: [], guidance: { avoid: [], lean: null } };
    const message = buildSynthesisMessage({ ...base, building: ["morning walk", "read 10 pages"] });
    expect(message).toMatch(/What members are building together \(habits they chose to share, no names\): morning walk, read 10 pages\./);
    expect(message).toMatch(/the suggestions come first/);
    expect(buildSynthesisMessage(base)).not.toMatch(/building together/);
  });
});

describe("rhythmGuidance", () => {
  it("avoids a theme the room has had three weeks running", () => {
    expect(rhythmGuidance(["relationships", "relationships", "relationships", "work"]).avoid).toEqual([
      "relationships",
    ]);
    expect(rhythmGuidance(["relationships", "work", "relationships"]).avoid).toEqual([]);
  });

  it("leans lighter after three heavy weeks and deeper after three light ones", () => {
    expect(rhythmGuidance(["faith", "money", "family"]).lean).toBe("lighter");
    expect(rhythmGuidance(["lighthearted", "culture", "lighthearted"]).lean).toBe("deeper");
    expect(rhythmGuidance(["faith", "lighthearted", "money"]).lean).toBeNull();
  });

  it("has no opinion about a room without enough history", () => {
    expect(rhythmGuidance([])).toEqual({ avoid: [], lean: null });
    expect(rhythmGuidance(["faith", null, "faith"])).toEqual({ avoid: [], lean: null });
  });
});

describe("selectOptions", () => {
  const opt = (text: string, theme: CandidateOption["theme"]): CandidateOption => ({ text, theme, rationale: null });

  it("drops avoided themes only while enough options remain", () => {
    const candidates = [
      opt("Relationship question one?", "relationships"),
      opt("Work question?", "work"),
      opt("Money question?", "money"),
      opt("Family question?", "family"),
      opt("Growth question?", "growth"),
    ];
    const chosen = selectOptions(candidates, {
      recentKeys: new Set(),
      guidance: { avoid: ["relationships"], lean: null },
      count: 4,
    });
    expect(chosen.map((c) => c.theme)).toEqual(["work", "money", "family", "growth"]);

    const short = selectOptions(candidates.slice(0, 4), {
      recentKeys: new Set(),
      guidance: { avoid: ["relationships"], lean: null },
      count: 4,
    });
    expect(short).toHaveLength(4);
  });

  it("makes room for a lighter option when the room needs air", () => {
    const candidates = [
      opt("Faith question?", "faith"),
      opt("Money question?", "money"),
      opt("Family question?", "family"),
      opt("Identity question?", "identity"),
      opt("What's the best meal you've had?", "lighthearted"),
    ];
    const chosen = selectOptions(candidates, {
      recentKeys: new Set(),
      guidance: { avoid: [], lean: "lighter" },
      count: 4,
    });
    expect(chosen.some((c) => c.theme === "lighthearted")).toBe(true);
    expect(chosen[0].theme).toBe("faith");
  });

  it("removes near-duplicate questions", () => {
    const chosen = selectOptions(
      [opt("Would you leave Oklahoma for your dream job?", "work"), opt("Would you leave Oklahoma for a dream job?", "work")],
      { recentKeys: new Set(), guidance: { avoid: [], lean: null }, count: 4 }
    );
    expect(chosen).toHaveLength(1);
  });
});

describe("the prompt bank", () => {
  it("is well-formed, varied and free of duplicates", () => {
    const keys = new Set(PROMPT_BANK.map((p) => topicKeyFor(p.text)));
    expect(keys.size).toBe(PROMPT_BANK.length);
    for (const p of PROMPT_BANK) {
      expect(p.text.endsWith("?")).toBe(true);
      expect(p.text.length).toBeLessThanOrEqual(140);
      expect(TOPIC_THEMES).toContain(p.theme);
    }
    expect(new Set(PROMPT_BANK.map((p) => p.theme)).size).toBe(TOPIC_THEMES.length);
  });

  it("passes the model output parser, holding itself to the same standard", () => {
    const parsed = parseGeneratedOptions({ options: PROMPT_BANK.map((p) => ({ ...p, rationale: "" })) });
    expect(parsed).toHaveLength(PROMPT_BANK.length);
  });
});
