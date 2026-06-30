import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uriEncode, uploadToS3, S3Config } from "../s3";

describe("uriEncode", () => {
  it("leaves unreserved characters untouched", () => {
    expect(uriEncode("abcABC123-_.~", false)).toBe("abcABC123-_.~");
  });

  it("encodes spaces and special characters", () => {
    expect(uriEncode("a b/c", false)).toBe("a%20b/c");
    expect(uriEncode("a b/c", true)).toBe("a%20b%2Fc");
  });

  it("encodes multibyte characters as UTF-8", () => {
    expect(uriEncode("あ", false)).toBe("%E3%81%82");
  });
});

describe("uploadToS3", () => {
  const config: S3Config = {
    endpoint: "https://minio.example.com",
    region: "us-east-1",
    bucket: "my-bucket",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "secret",
    pathStyle: true,
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("PUTs to a path-style URL with a public-read SigV4 signature", async () => {
    const now = new Date("2013-05-24T00:00:00Z");
    const result = await uploadToS3(
      config,
      "dir/file.html",
      "<html></html>",
      "text/html",
      now,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://minio.example.com/my-bucket/dir/file.html");
    expect(init.method).toBe("PUT");
    expect(init.headers["x-amz-acl"]).toBe("public-read");
    expect(init.headers["x-amz-date"]).toBe("20130524T000000Z");
    expect(init.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/20130524\/us-east-1\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    expect(result.url).toBe(
      "https://minio.example.com/my-bucket/dir/file.html",
    );
  });

  it("produces a deterministic signature for identical inputs", async () => {
    const now = new Date("2013-05-24T00:00:00Z");
    await uploadToS3(config, "a.html", "body", "text/html", now);
    await uploadToS3(config, "a.html", "body", "text/html", now);
    const first = fetchMock.mock.calls[0][1].headers.Authorization;
    const second = fetchMock.mock.calls[1][1].headers.Authorization;
    expect(first).toBe(second);
  });

  it("uses publicBaseUrl for the shareable link when provided", async () => {
    const now = new Date("2013-05-24T00:00:00Z");
    const result = await uploadToS3(
      { ...config, publicBaseUrl: "https://files.example.com/" },
      "a.html",
      "body",
      "text/html",
      now,
    );
    expect(result.url).toBe("https://files.example.com/a.html");
  });

  it("builds a virtual-hosted URL when path-style is disabled", async () => {
    const now = new Date("2013-05-24T00:00:00Z");
    await uploadToS3(
      { ...config, pathStyle: false },
      "a.html",
      "body",
      "text/html",
      now,
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://my-bucket.minio.example.com/a.html");
    expect(init.headers.Authorization).toContain("host");
  });

  it("throws with detail on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: () => Promise.resolve("AccessDenied"),
    });
    await expect(
      uploadToS3(config, "a.html", "body", "text/html"),
    ).rejects.toThrow(/HTTP 403 Forbidden - AccessDenied/);
  });
});
