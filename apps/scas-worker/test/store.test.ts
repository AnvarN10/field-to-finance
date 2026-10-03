import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { MemoryStore, S3Store } from "../src/store";

const OPTS = {
  bucket: "f2f-evidence-abc",
  endpoint: "https://t3.storageapi.dev",
  region: "auto",
  accessKeyId: "ak",
  secretAccessKey: "sk",
  forcePathStyle: false,
};

function fakeS3(reply: (cmd: unknown) => unknown) {
  const sent: unknown[] = [];
  const client = {
    send: async (cmd: unknown) => {
      sent.push(cmd);
      return reply(cmd);
    },
  } as unknown as Pick<S3Client, "send">;
  return { client, sent };
}

describe("MemoryStore", () => {
  it("round-trips objects", async () => {
    const store = new MemoryStore();
    await store.put("a", new Uint8Array([1, 2]), "application/json");
    expect(await store.get("a")).toEqual(new Uint8Array([1, 2]));
    expect(await store.get("missing")).toBeNull();
  });
});

describe("S3Store", () => {
  it("puts objects with bucket, key and content type", async () => {
    const { client, sent } = fakeS3(() => ({}));
    await new S3Store(OPTS, client).put("evidence/x.json", new Uint8Array([1]), "application/json");
    const cmd = sent[0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: OPTS.bucket, Key: "evidence/x.json", ContentType: "application/json" });
  });

  it("returns bytes for an existing object and null for NoSuchKey", async () => {
    const found = fakeS3(() => ({ Body: { transformToByteArray: async () => new Uint8Array([7]) } }));
    expect(await new S3Store(OPTS, found.client).get("k")).toEqual(new Uint8Array([7]));
    expect(found.sent[0]).toBeInstanceOf(GetObjectCommand);

    const missing = fakeS3(() => {
      throw Object.assign(new Error("not found"), { name: "NoSuchKey" });
    });
    expect(await new S3Store(OPTS, missing.client).get("k")).toBeNull();
  });
});
