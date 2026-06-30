/**
 * Deterministically normalizes CJK markdown so that emphasis delimiters
 * (`*`, `**`, `***`, `_`, `__`, `___`) adjacent to CJK punctuation are parsed
 * as intended by CommonMark.
 *
 * Languages without inter-word spacing (Chinese, Japanese, Korean) frequently
 * place punctuation directly next to emphasis delimiters. CommonMark decides
 * whether a delimiter run opens or closes emphasis using its "left-flanking" /
 * "right-flanking" classification, which depends on the Unicode punctuation
 * category of the surrounding characters. When a delimiter that is meant to
 * open is immediately followed by punctuation (and preceded by a regular
 * character) it cannot be left-flanking; when a delimiter that is meant to
 * close is immediately preceded by punctuation (and followed by a regular
 * character) it cannot be right-flanking. In either case the delimiter is
 * rendered literally instead of producing emphasis. For example:
 *
 *   ✗ **強調。**続き        -> closing ** preceded by 。 fails to close
 *   ✗ 字**「重要」**です     -> both delimiters fail (around 「」)
 *
 * The fix is to insert a single space on the outside of the offending
 * delimiter (before an opener, after a closer) so the run becomes flanking and
 * the emphasis renders:
 *
 *   ○ **強調。** 続き
 *   ○ 字 **「重要」** です
 *
 * Crucially, the same punctuation adjacency that breaks an *opening* delimiter
 * is harmless for a *closing* one (and vice versa). `cmark-cjk-lint`'s regexes
 * cannot tell the two roles apart, so blindly inserting spaces for every match
 * would break emphasis that already renders correctly (e.g. `**金額**（補足）`).
 * This module therefore pairs the delimiter runs first and only fixes a
 * delimiter when it genuinely fails the flanking test for the role it plays.
 */

// Any CJK letter (Hiragana, Katakana, half-width Katakana, CJK ideographs,
// Hangul). Used to decide whether the document is CJK content at all.
const CJK_LETTER = /[぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ가-힯]/u;

// A maximal run of emphasis delimiter characters (all `*` or all `_`).
const DELIM_RUN = /\*+|_+/g;

// Fenced code block boundary (``` or ~~~), possibly indented.
const FENCE = /^\s*(```|~~~)/;

// Inline code span, used to split a line so code is never rewritten.
const INLINE_CODE = /(`[^`]*`)/;

const UNICODE_PUNCT = /\p{P}/u;
const WHITESPACE = /\s/;

// Mirrors cmark-cjk-lint: the emphasis delimiters themselves are excluded from
// the punctuation class so an adjacent delimiter is not treated as punctuation.
const isPunctuation = (ch: string | undefined): boolean =>
  ch !== undefined && ch !== "*" && ch !== "_" && UNICODE_PUNCT.test(ch);

// A character that is neither punctuation nor whitespace (e.g. a CJK letter or
// an ASCII word character). The start/end of a segment counts as whitespace.
const isWordish = (ch: string | undefined): boolean =>
  ch !== undefined && !WHITESPACE.test(ch) && !UNICODE_PUNCT.test(ch);

interface Run {
  start: number;
  end: number;
  text: string;
}

const findRuns = (segment: string): Run[] => {
  const runs: Run[] = [];
  DELIM_RUN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DELIM_RUN.exec(segment)) !== null) {
    runs.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
    });
  }
  return runs;
};

const fixSegment = (segment: string): string => {
  const runs = findRuns(segment);
  if (runs.length < 2) {
    return segment;
  }

  // Pair runs sharing the same delimiter token (e.g. all `**`) in order:
  // the first opens, the second closes, and so on. This matches how an LLM
  // writes balanced emphasis and lets us know each delimiter's role.
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const group = groups.get(run.text);
    if (group) {
      group.push(run);
    } else {
      groups.set(run.text, [run]);
    }
  }

  // Positions at which a space must be inserted (immediately before the index).
  const insertions = new Set<number>();
  for (const group of groups.values()) {
    for (let i = 0; i + 1 < group.length; i += 2) {
      const opener = group[i];
      const closer = group[i + 1];

      // Opener fails to be left-flanking: regular char before, punctuation
      // after -> add a space before it.
      if (
        isWordish(segment[opener.start - 1]) &&
        isPunctuation(segment[opener.end])
      ) {
        insertions.add(opener.start);
      }

      // Closer fails to be right-flanking: punctuation before, regular char
      // after -> add a space after it.
      if (
        isPunctuation(segment[closer.start - 1]) &&
        isWordish(segment[closer.end])
      ) {
        insertions.add(closer.end);
      }
    }
  }

  if (insertions.size === 0) {
    return segment;
  }

  let result = "";
  for (let i = 0; i < segment.length; i++) {
    if (insertions.has(i)) {
      result += " ";
    }
    result += segment[i];
  }
  return result;
};

const fixLine = (line: string): string =>
  line
    .split(INLINE_CODE)
    // Odd indices are inline code spans and are left untouched.
    .map((part, index) => (index % 2 === 1 ? part : fixSegment(part)))
    .join("");

/**
 * Returns a deterministically valid version of the given markdown. Lines inside
 * fenced code blocks and inline code spans are preserved verbatim. Non-CJK
 * documents are returned unchanged.
 */
export const normalizeCjkMarkdown = (text: string): string => {
  if (!CJK_LETTER.test(text)) {
    return text;
  }

  let insideFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) {
        insideFence = !insideFence;
        return line;
      }
      if (insideFence) {
        return line;
      }
      return fixLine(line);
    })
    .join("\n");
};
