import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sha256, toHex } from "@f2f/sdk";
import { RequestError } from "./errors";

export interface BlobStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export class MemoryStore implements BlobStore {
  readonly objects = new Map<string, Uint8Array>();
  async put(key: string, body: Uint8Array, _contentType?: string): Promise<void> {
    this.objects.set(key, body.slice());
  }
  async get(key: string): Promise<Uint8Array | null> {
    return this.objects.get(key)?.slice() ?? null;
  }
}

export interface S3StoreOptions {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** Railway buckets are private, S3-compatible and virtual-host style by default. */
export class S3Store implements BlobStore {
  private readonly client: S3Client;
  constructor(private readonly opts: S3StoreOptions) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      forcePathStyle: opts.forcePathStyle,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }
  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string): Promise<Uint8Array | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw e;
    }
  }
}

export const polygonKey = (hashHex: string) => `polygons/${hashHex}.json`;
export const evidenceKey = (hashHex: string) => `evidence/${hashHex}.json`;
export const HEX64 = /^[0-9a-f]{64}$/;

/** Content-addressed read: the bytes must hash to the name they are stored under. */
export async function readHashed(store: BlobStore, key: string, hashHex: string): Promise<Uint8Array | null> {
  const bytes = await store.get(key);
  if (!bytes) return null;
  if (toHex(sha256(bytes)) !== hashHex) throw new RequestError(`stored object ${key} does not match its hash`, 502);
  return bytes;
}

export async function serveHashed(store: BlobStore, key: string, hashHex: string): Promise<Response> {
  if (!HEX64.test(hashHex)) return Response.json({ error: "hash must be 64 lowercase hex characters" }, { status: 400 });
  try {
    const bytes = await readHashed(store, key, hashHex);
    if (!bytes) return Response.json({ error: "not found" }, { status: 404 });
    return new Response(bytes.slice(), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch (e) {
    if (e instanceof RequestError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
