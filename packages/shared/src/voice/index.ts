/**
 * Turning a streamed reply into speech.
 *
 * The guide's words arrive a few at a time. Waiting for the whole reply
 * before speaking adds seconds of dead air to every turn, which is what
 * makes voice assistants feel robotic. Instead each sentence is spoken the
 * moment it's complete, while the rest is still being written.
 */

/** Text as it should be spoken: no markdown, emoji, or bracketed notes. */
export function speakable(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\*\*|__|`|#+\s/g, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sentences shorter than this wait for the next one ("Hey." alone sounds clipped). */
const MIN_CHUNK = 24;

/**
 * Feed it streamed text; it hands back whole sentences, ready to speak.
 * `flush()` returns whatever is left when the stream ends.
 */
export function createSentenceSplitter() {
  let buffer = "";
  return {
    push(delta: string): string[] {
      buffer += delta;
      const out: string[] = [];
      // A sentence ends at . ! ? (plus any closing quote or bracket) or a
      // line break, and only once whitespace follows — so "2.5" and "7:30"
      // never split, and a "." at the very end waits for the next chunk.
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const ch = buffer[i];
        let end = -1;
        if (ch === "\n") end = i + 1;
        else if (ch === "." || ch === "!" || ch === "?") {
          let j = i + 1;
          while (j < buffer.length && /[.!?"'”’)\]]/.test(buffer[j])) j++;
          if (j < buffer.length && /\s/.test(buffer[j])) end = j;
          i = j - 1;
        }
        if (end > 0 && speakable(buffer.slice(start, end)).length >= MIN_CHUNK) {
          out.push(speakable(buffer.slice(start, end)));
          start = end;
        }
      }
      buffer = buffer.slice(start);
      return out.filter(Boolean);
    },
    flush(): string[] {
      const rest = speakable(buffer);
      buffer = "";
      return rest ? [rest] : [];
    },
  };
}
