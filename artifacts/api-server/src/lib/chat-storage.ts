import { Storage } from "@google-cloud/storage";

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
  const { bucket, privateDir } = config();
  return storage.bucket(bucket).file(`${privateDir}/${objectPath.slice("/objects/".length)}`);
}

export async function deleteObject(objectPath: string): Promise<void> {
  await fileForObjectPath(objectPath).delete({ ignoreNotFound: true });
}

export async function cleanupUnreferencedUploads(
  referencedObjectPaths: Set<string>,
  olderThanMs = 60 * 60 * 1000,
): Promise<number> {
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