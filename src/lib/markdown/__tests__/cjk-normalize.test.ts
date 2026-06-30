import { describe, it, expect } from "vitest";
import { normalizeCjkMarkdown } from "../cjk-normalize";

describe("normalizeCjkMarkdown", () => {
  it("fixes a closing delimiter stuck behind CJK punctuation", () => {
    expect(normalizeCjkMarkdown("**強調。**続き")).toBe("**強調。** 続き");
  });

  it("fixes an opening delimiter that runs into CJK punctuation", () => {
    expect(normalizeCjkMarkdown("字**「重要」**です")).toBe(
      "字 **「重要」** です",
    );
  });

  it("fixes a paragraph-internal bold ending with a period", () => {
    expect(
      normalizeCjkMarkdown("これは**やりたかったこと。**だからするの"),
    ).toBe("これは**やりたかったこと。** だからするの");
  });

  it("leaves a working bold whose closer precedes punctuation untouched", () => {
    // `**金額**（補足）` already renders; naively spacing it would break it.
    const input = "利益剰余金**1億円**（補足）";
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("leaves a working bold whose opener follows punctuation untouched", () => {
    const input = "前置き。**強調**です";
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("does not touch emphasis surrounded by punctuation", () => {
    const input = "「**重要**」";
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("does not touch a bold that ends the line after punctuation", () => {
    const input = "以上で**説明は終わり。**";
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("handles single-star emphasis", () => {
    expect(normalizeCjkMarkdown("これは*斜体。*続き")).toBe(
      "これは*斜体。* 続き",
    );
  });

  it("handles multiple emphasis spans on one line", () => {
    expect(normalizeCjkMarkdown("**第一。**そして**第二。**おわり")).toBe(
      "**第一。** そして**第二。** おわり",
    );
  });

  it("leaves non-CJK markdown unchanged", () => {
    const input = "This is **bold**, and so is *this*.";
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("does not touch unpaired delimiters", () => {
    const input = "掛け算は 2*3 と 4*5。";
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("preserves fenced code blocks verbatim", () => {
    const input = [
      "説明します。",
      "```",
      "x = **a。**b",
      "```",
      "本文**です。**",
    ].join("\n");
    expect(normalizeCjkMarkdown(input)).toBe(input);
  });

  it("preserves inline code spans verbatim", () => {
    expect(normalizeCjkMarkdown("値は`**a。**b`と表示**する。**確認")).toBe(
      "値は`**a。**b`と表示**する。** 確認",
    );
  });

  it("is idempotent", () => {
    const once = normalizeCjkMarkdown("**強調。**続き");
    expect(normalizeCjkMarkdown(once)).toBe(once);
  });
});
