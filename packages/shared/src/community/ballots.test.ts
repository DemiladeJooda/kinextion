import { describe, expect, it } from "vitest";
import { decideClosure, tallyBallot, topicKeyFor } from "./ballots.js";

const options = [
  { id: "a", ordinal: 0 },
  { id: "b", ordinal: 1 },
  { id: "c", ordinal: 2 },
];

describe("tallyBallot", () => {
  it("picks the option with the most votes", () => {
    const votes = [{ optionId: "b" }, { optionId: "b" }, { optionId: "a" }];
    expect(tallyBallot(options, votes).winnerId).toBe("b");
  });

  it("breaks a tie toward the lower ordinal, the same way every time", () => {
    const votes = [{ optionId: "c" }, { optionId: "b" }, { optionId: "c" }, { optionId: "b" }];
    for (let i = 0; i < 5; i++) expect(tallyBallot([...options].reverse(), votes).winnerId).toBe("b");
  });

  it("defaults to the first option when nobody voted", () => {
    expect(tallyBallot(options, []).winnerId).toBe("a");
  });

  it("ignores votes for options not on the ballot", () => {
    expect(tallyBallot(options, [{ optionId: "zzz" }, { optionId: "zzz" }, { optionId: "c" }]).winnerId).toBe("c");
  });

  it("has no winner without options", () => {
    expect(tallyBallot([], [{ optionId: "a" }]).winnerId).toBeNull();
  });
});

describe("decideClosure", () => {
  it("closes on a supermajority with enough turnout", () => {
    expect(decideClosure({ closeVotes: 6, keepVotes: 2, activeMembers: 12 })).toBe("close");
  });

  it("keeps a community when too few people voted, however one-sided", () => {
    expect(decideClosure({ closeVotes: 5, keepVotes: 0, activeMembers: 12 })).toBe("keep");
  });

  it("keeps a community on a simple majority", () => {
    expect(decideClosure({ closeVotes: 7, keepVotes: 5, activeMembers: 12 })).toBe("keep");
  });

  it("treats exactly two thirds as enough", () => {
    expect(decideClosure({ closeVotes: 6, keepVotes: 3, activeMembers: 12 })).toBe("close");
  });

  it("keeps when nobody voted", () => {
    expect(decideClosure({ closeVotes: 0, keepVotes: 0, activeMembers: 12 })).toBe("keep");
  });
});

describe("topicKeyFor", () => {
  it("matches the same question asked slightly differently", () => {
    expect(topicKeyFor("Would you leave Oklahoma for your dream job?")).toBe(
      topicKeyFor("Would you leave Oklahoma for a dream job?")
    );
  });

  it("ignores case, punctuation and accents", () => {
    expect(topicKeyFor("Is CAFÉ culture overrated?!")).toBe(topicKeyFor("is cafe culture overrated"));
  });

  it("distinguishes genuinely different questions", () => {
    expect(topicKeyFor("Should Christians use dating apps?")).not.toBe(
      topicKeyFor("Has social media made dating worse?")
    );
  });

  it("never returns an empty key", () => {
    expect(topicKeyFor("?!")).toBe("untitled");
  });
});
