import {
  createReadStream,
  createWriteStream,
  existsSync,
} from "node:fs";
import {
  mkdir,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type StorageMetadata = {
  contentType?: string;
  size?: number | string;
};

type DeleteOptions = {
  ignoreNotFound?: boolean;
};

type WriteOptions = {
  metadata?: {
    contentType?: string;
  };
  resumable?: boolean;
};

type StorageFile = {
  createReadStream(): NodeJS.ReadableStream;
  createWriteStream(options?: WriteOptions): NodeJS.WritableStream;
  delete(options?: DeleteOptions): Promise<void>;
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[StorageMetadata]>;
};

type SupabaseStorageConfig = {
  bucket: string;
  prefix: string;
  serviceRoleKey: string;
  url: string;
};

function normalizeObjectPath(objectPath: string): string {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error("Object path must begin with /objects/.");
  }
  const normalized = path.posix.normalize(objectPath).replace(/^\/+/, "");
  if (!normalized.startsWith("objects/") || normalized.includes("..")) {
    throw new Error("Invalid object path.");
  }
  return normalized;
}

function encodedPath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

function getSupabaseConfig(): SupabaseStorageConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.",
      );
    }
    return null;
  }
  return {
    url,
    serviceRoleKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "chat-media",
    prefix: (process.env.SUPABASE_STORAGE_PREFIX ?? "old-time")
      .replace(/^\/+|\/+$/g, ""),
  };
}

async function supabaseRequest(
  config: SupabaseStorageConfig,
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceRoleKey);
  headers.set("authorization", `Bearer ${config.serviceRoleKey}`);
  return fetch(`${config.url}/storage/v1${endpoint}`, {
    ...init,
    headers,
  });
}

async function responseError(response: Response): Promise<Error> {
  const detail = await response.text().catch(() => "");
  return new Error(
    `Supabase Storage request failed (${response.status})${detail ? `: ${detail}` : ""}`,
  );
}

class SupabaseObjectFile implements StorageFile {
  readonly key: string;

  constructor(
    private readonly config: SupabaseStorageConfig,
    objectPath: string,
  ) {
    const normalized = normalizeObjectPath(objectPath).replace(/^objects\//, "");
    this.key = [config.prefix, normalized].filter(Boolean).join("/");
  }

  private endpoint(): string {
    return `/object/${encodeURIComponent(this.config.bucket)}/${encodedPath(this.key)}`;
  }

  private infoEndpoint(): string {
    return `/object/info/${encodeURIComponent(this.config.bucket)}/${encodedPath(this.key)}`;
  }

  createWriteStream(options: WriteOptions = {}): NodeJS.WritableStream {
    const chunks: Buffer[] = [];
    const config = this.config;
    const endpoint = this.endpoint();
    return new Writable({
      write(chunk: Buffer | string, encoding, callback) {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding),
        );
        callback();
      },
      final(callback) {
        void (async () => {
          const body = Buffer.concat(chunks);
          const response = await supabaseRequest(config, endpoint, {
            method: "POST",
            headers: {
              "content-type":
                options.metadata?.contentType ?? "application/octet-stream",
              "x-upsert": "true",
            },
            body,
          });
          if (!response.ok) throw await responseError(response);
        })().then(
          () => callback(),
          (error: unknown) =>
            callback(error instanceof Error ? error : new Error(String(error))),
        );
      },
    });
  }

  createReadStream(): NodeJS.ReadableStream {
    const stream = new PassThrough();
    void (async () => {
      const response = await supabaseRequest(this.config, this.endpoint());
      if (!response.ok) throw await responseError(response);
      stream.end(Buffer.from(await response.arrayBuffer()));
    })().catch((error: unknown) => {
      stream.destroy(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
    return stream;
  }

  async exists(): Promise<[boolean]> {
    const response = await supabaseRequest(this.config, this.infoEndpoint());
    if (response.status === 404) return [false];
    if (response.status === 400) {
      const payload = await response.clone().json().catch(() => null) as {
        code?: string;
        statusCode?: string;
      } | null;
      if (payload?.code === "NoSuchKey" || payload?.statusCode === "404") {
        return [false];
      }
    }
    if (!response.ok) throw await responseError(response);
    return [true];
  }

  async getMetadata(): Promise<[StorageMetadata]> {
    const response = await supabaseRequest(this.config, this.infoEndpoint());
    if (!response.ok) throw await responseError(response);
    const object = await response.json() as {
      content_type?: string;
      metadata?: {
        mimetype?: string;
        size?: number;
      };
      size?: number;
    };
    return [{
      contentType: object.content_type ?? object.metadata?.mimetype,
      size: object.size ?? object.metadata?.size,
    }];
  }

  async delete(options: DeleteOptions = {}): Promise<void> {
    const response = await supabaseRequest(this.config, this.endpoint(), {
      method: "DELETE",
    });
    if (response.status === 404 && options.ignoreNotFound) return;
    if (!response.ok) throw await responseError(response);
  }
}

class LocalObjectFile implements StorageFile {
  constructor(private readonly absolutePath: string) {}

  createWriteStream(): NodeJS.WritableStream {
    return createWriteStream(this.absolutePath);
  }

  createReadStream(): NodeJS.ReadableStream {
    return createReadStream(this.absolutePath);
  }

  async exists(): Promise<[boolean]> {
    return [existsSync(this.absolutePath)];
  }

  async getMetadata(): Promise<[StorageMetadata]> {
    const details = await stat(this.absolutePath);
    return [{ size: details.size }];
  }

  async delete(options: DeleteOptions = {}): Promise<void> {
    await rm(this.absolutePath, {
      force: options.ignoreNotFound ?? false,
    });
  }
}

function localStorageRoot(): string {
  return process.env.LOCAL_OBJECT_STORAGE_DIR
    ?? path.resolve(process.cwd(), ".local", "object-storage");
}

export function fileForObjectPath(objectPath: string): StorageFile {
  const config = getSupabaseConfig();
  if (config) return new SupabaseObjectFile(config, objectPath);

  const normalized = normalizeObjectPath(objectPath).replace(/^objects\//, "");
  const absolutePath = path.join(localStorageRoot(), normalized);
  const root = path.resolve(localStorageRoot());
  if (!path.resolve(absolutePath).startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid local object path.");
  }
  mkdir(path.dirname(absolutePath), { recursive: true }).catch(() => undefined);
  return new LocalObjectFile(absolutePath);
}

export async function deleteObject(objectPath: string): Promise<void> {
  await fileForObjectPath(objectPath).delete({ ignoreNotFound: true });
}

export async function cleanupUnreferencedUploads(
  referencedPaths: Set<string>,
): Promise<void> {
  const config = getSupabaseConfig();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  if (config) {
    const folder = [config.prefix, "uploads"].filter(Boolean).join("/");
    const response = await supabaseRequest(
      config,
      `/object/list/${encodeURIComponent(config.bucket)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prefix: folder,
          limit: 1000,
          offset: 0,
          sortBy: { column: "created_at", order: "asc" },
        }),
      },
    );
    if (!response.ok) throw await responseError(response);
    const objects = await response.json() as Array<{
      created_at?: string;
      name?: string;
    }>;
    await Promise.all(objects.map(async (object) => {
      if (!object.name || !object.created_at) return;
      if (new Date(object.created_at).getTime() >= cutoff) return;
      const logicalPath = `/objects/uploads/${object.name}`;
      if (!referencedPaths.has(logicalPath)) {
        await deleteObject(logicalPath);
      }
    }));
    return;
  }

  const uploadsRoot = path.join(localStorageRoot(), "uploads");
  const entries = await readdir(uploadsRoot, { withFileTypes: true })
    .catch(() => []);
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) return;
    const logicalPath = `/objects/uploads/${entry.name}`;
    if (referencedPaths.has(logicalPath)) return;
    const absolutePath = path.join(uploadsRoot, entry.name);
    const details = await stat(absolutePath);
    if (details.mtimeMs < cutoff) {
      await rm(absolutePath, { force: true });
    }
  }));
}