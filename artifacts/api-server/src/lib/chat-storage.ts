import { Storage } from "@google-cloud/storage";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const sidecar = "http://127.0.0.1:1106";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

type ObjectMetadata = {
  size?: number | string;
  contentType?: string;
  timeCreated?: string;
};

type StorageFile = {
  createWriteStream(options?: { resumable?: boolean; metadata?: { contentType?: string } }): NodeJS.WritableStream;
  createReadStream(): NodeJS.ReadableStream;
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[ObjectMetadata]>;
  delete(options?: { ignoreNotFound?: boolean }): Promise<unknown>;
  name?: string;
  metadata?: ObjectMetadata;
};

class LocalObjectFile implements StorageFile {
  readonly name: string;
  readonly metadata?: ObjectMetadata;

  constructor(private readonly filePath: string, private readonly contentType: string) {
    this.name = filePath;
  }

  createWriteStream(options?: { resumable?: boolean; metadata?: { contentType?: string } }) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(
      `${this.filePath}.meta.json`,
      JSON.stringify({ contentType: options?.metadata?.contentType ?? this.contentType }),
    );
    return createWriteStream(this.filePath);
  }

  createReadStream() {
    return createReadStream(this.filePath);
  }

  async exists(): Promise<[boolean]> {
    return [existsSync(this.filePath)];
  }

  async getMetadata(): Promise<[ObjectMetadata]> {
    const stat = statSync(this.filePath);
    let metadata: ObjectMetadata = { size: stat.size, contentType: this.contentType, timeCreated: stat.birthtime.toISOString() };
    try {
      metadata = { ...metadata, ...JSON.parse(readFileSync(`${this.filePath}.meta.json`, "utf8")) };
    } catch {
      // The metadata sidecar is best-effort; content type is retained from the upload slot.
    }
    return [metadata];
  }

  async delete(options?: { ignoreNotFound?: boolean }) {
    try {
      unlinkSync(this.filePath);
      unlinkSync(`${this.filePath}.meta.json`);
    } catch (error) {
      if (!options?.ignoreNotFound) throw error;
    }
  }
}

function localObjectRoot() {
  return resolve(process.cwd(), ".data/object-storage");
}

function useLocalStorage() {
  return process.env.NODE_ENV !== "production" && (!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || !process.env.PRIVATE_OBJECT_DIR);
}

function config(): { bucket: string; privateDir: string } {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!bucket || !privateDir) {
    throw new Error("App Storage is not configured. Set DEFAULT_OBJECT_STORAGE_BUCKET_ID and PRIVATE_OBJECT_DIR.");
  }
  return { bucket, privateDir: privateDir.replace(/^\/+|\/+$/g, "") };
}

export function fileForObjectPath(objectPath: string) {
  if (!objectPath.startsWith("/objects/") || objectPath.includes("..")) {
    throw new Error("Invalid object path.");
  }
  if (useLocalStorage()) {
    const relativePath = objectPath.slice("/objects/".length);
    const filePath = join(localObjectRoot(), relativePath);
    const root = localObjectRoot();
    if (!filePath.startsWith(`${root}/`)) throw new Error("Invalid object path.");
    return new LocalObjectFile(filePath, "application/octet-stream");
  }
  const { bucket, privateDir } = config();
  return storage.bucket(bucket).file(`${privateDir}/${objectPath.slice("/objects/".length)}`) as unknown as StorageFile;
}

export async function deleteObject(objectPath: string): Promise<void> {
  await fileForObjectPath(objectPath).delete({ ignoreNotFound: true });
}

export async function cleanupUnreferencedUploads(
  referencedObjectPaths: Set<string>,
  olderThanMs = 60 * 60 * 1000,
): Promise<number> {
  if (useLocalStorage()) return 0;
  const { bucket, privateDir } = config();
  const prefix = `${privateDir}/uploads/`;
  const [files] = await storage.bucket(bucket).getFiles({ prefix });
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;

  for (const file of files) {
    const objectPath = `/objects/${file.name.slice(prefix.length)}`;
    const createdAt = Date.parse(String(file.metadata.timeCreated ?? ""));
    if (
      !referencedObjectPaths.has(objectPath) &&
      Number.isFinite(createdAt) &&
      createdAt < cutoff
    ) {
      await file.delete({ ignoreNotFound: true });
      removed += 1;
    }
  }

  return removed;
}