export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle: boolean;
  publicBaseUrl?: string;
}

export interface S3UploadResult {
  url: string;
}

const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return toHex(digest);
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  data: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

// AWS-style URI encoding. Unreserved characters are left as-is; slashes are
// optionally preserved for path components.
export function uriEncode(value: string, encodeSlash: boolean): string {
  let result = "";
  for (const char of value) {
    if (/[A-Za-z0-9\-_.~]/.test(char)) {
      result += char;
    } else if (char === "/") {
      result += encodeSlash ? "%2F" : "/";
    } else {
      for (const byte of encoder.encode(char)) {
        result += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
      }
    }
  }
  return result;
}

function timestamps(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amzDate = iso.slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

async function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
): Promise<ArrayBuffer> {
  const kDate = await hmac(encoder.encode("AWS4" + secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}

function normalizeEndpoint(endpoint: string): { origin: string; host: string } {
  const url = new URL(endpoint);
  return { origin: `${url.protocol}//${url.host}`, host: url.host };
}

function buildObjectLocation(
  config: S3Config,
  key: string,
): { requestUrl: string; host: string; canonicalUri: string } {
  const { origin, host } = normalizeEndpoint(config.endpoint);
  const encodedKey = uriEncode(key, false);

  if (config.pathStyle) {
    const canonicalUri = `/${config.bucket}/${encodedKey}`;
    return { requestUrl: `${origin}${canonicalUri}`, host, canonicalUri };
  }

  const virtualHost = `${config.bucket}.${host}`;
  const canonicalUri = `/${encodedKey}`;
  const protocol = origin.split("//")[0];
  return {
    requestUrl: `${protocol}//${virtualHost}${canonicalUri}`,
    host: virtualHost,
    canonicalUri,
  };
}

function resolvePublicUrl(config: S3Config, key: string): string {
  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.replace(/\/+$/, "");
    return `${base}/${uriEncode(key, false)}`;
  }
  return buildObjectLocation(config, key).requestUrl;
}

export async function uploadToS3(
  config: S3Config,
  key: string,
  body: string,
  contentType: string,
  now: Date = new Date(),
): Promise<S3UploadResult> {
  const { requestUrl, host, canonicalUri } = buildObjectLocation(config, key);
  const { amzDate, dateStamp } = timestamps(now);
  const payloadHash = await sha256Hex(body);
  const acl = "public-read";

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:${acl}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders =
    "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    ALGORITHM,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const key4 = await signingKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
  );
  const signature = toHex(await hmac(key4, stringToSign));

  const authorization =
    `${ALGORITHM} Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(requestUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-acl": acl,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `S3 upload failed: HTTP ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`,
    );
  }

  return { url: resolvePublicUrl(config, key) };
}
