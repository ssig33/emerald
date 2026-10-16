import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildObjectKey } from "../useConversationExport";

describe("buildObjectKey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5));
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const name = `20260102-030405-${(0.123456789).toString(36).slice(2, 8)}.html`;

  it("uses a timestamped file name when the prefix is empty", () => {
    expect(buildObjectKey("")).toBe(name);
  });

  it("puts the file under the prefix", () => {
    expect(buildObjectKey("emerald")).toBe(`emerald/${name}`);
    expect(buildObjectKey("a/b")).toBe(`a/b/${name}`);
  });

  it("strips leading and trailing slashes from the prefix", () => {
    expect(buildObjectKey("/emerald/")).toBe(`emerald/${name}`);
    expect(buildObjectKey("//a/b//")).toBe(`a/b/${name}`);
  });

  it("treats a prefix of only slashes as empty", () => {
    expect(buildObjectKey("///")).toBe(name);
  });
});
