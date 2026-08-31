import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const compressedTemplate =
  'H4sIAAAAAAACA8VUzY7TMBC+71MMOXChTQriTyUpSAtInBah7mFPK9eeJiP8J3vaNDcegifkSXCaVqRsWbQXODgZe+abb+aLM+Wj91eXy5vPH6BhoxcXZf8CLWxdZWizxQVA2aBQvZFMgyxANiJE5Cq7Xn6cvs6gGDutMFhlW8LWu8AZSGcZbQpuSXFTKdySxOl+MwGyxCT0NEqhsXqazyZgxI7MxhyPfmVnYo2LK61gSQbhshFcFsPhHXqFUQbyTM6OKjjBwo9v32G1Ic3gLHxBr4lzuPZKMAI3FGGUBNhBwLVGycmHILzPz/Yd3MpxHHGSVbibwNpp7drfID44j4G7KnP1fN/Jn4q9D/gfej0tvPPjultcRWI8qw63xIxhLkVQI0jcGCNCd6tFqPGWjKjvhz9EqlPkv9VKk/2a3DrdAtkT9kolu++viNv6yc7oDJqEr7JiLbZ9UJ7OzyXwAZPXJp4jomH2cV4U69RFzGvnao3CU8ylM9nD8ZEFk9yDQQYXowtUkx0n+jtvIWN89nYtDOmu+mR7xdu64XfPZ7M3L9J6mdar2eyxoui16KrYCp8NBUbuNMYGkYeZUxyHTrlyqjuUoWgLpPq/zKWwskj7g2f4IgeFjVOb/oLEIJOy6VkYQTbnuOtBQ+hAMuROZPvZ9xOEOv8fDAUAAA==';

const outputPath = new URL('../index.html', import.meta.url);
const html = gunzipSync(Buffer.from(compressedTemplate, 'base64'));

let current = null;
try {
  current = await readFile(outputPath);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

if (!current?.equals(html)) {
  await writeFile(outputPath, html);
}