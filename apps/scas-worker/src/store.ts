import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export interface BlobStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export class MemoryStore implements BlobStore {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.objects.get(key)?.body ?? null;
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

/** Railway bucket (S3-compatible, private). Keys are content hashes, so writes are idempotent. */
export class S3Store implements BlobStore {
  private readonly client: Pick<S3Client, "send">;

  constructor(
    private readonly opts: S3StoreOptions,
    client?: Pick<S3Client, "send">,
  ) {
    this.client =
      client ??
      new S3Client({
        endpoint: opts.endpoint,
        region: opts.region,
        forcePathStyle: opts.forcePathStyle,
        credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
        // Newer SDKs add CRC checksums by default; S3-compatible stores may reject them.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      return out.Body ? await out.Body.transformToByteArray() : null;
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }
}
