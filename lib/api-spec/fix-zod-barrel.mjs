import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const barrelPath = path.resolve(currentDir, "..", "api-zod", "src", "index.ts");
const source = await readFile(barrelPath, "utf8");
const fixed = source.replace(/\nexport \* from ['"]\.\/generated\/types['"];\s*$/u, "\n");

if (fixed !== source) {
  await writeFile(barrelPath, fixed);
}