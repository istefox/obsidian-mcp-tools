import type { VaultLike } from "./indexer";

/**
 * Sample up to `sampleSize` files and return the ratio of non-ASCII
 * characters to total characters. Used by the `"auto"` provider path
 * to surface a multilingual-provider suggestion when the vault
 * appears to contain significant non-English content.
 *
 * Returns 0 for an empty vault or when all sampled files fail to read.
 */
export async function detectNonAsciiRatio(
  vault: VaultLike,
  sampleSize = 50,
): Promise<number> {
  const files = vault.getMarkdownFiles().slice(0, sampleSize);
  let total = 0;
  let nonAscii = 0;
  for (const f of files) {
    let content: string;
    try {
      content = await vault.read(f.path);
    } catch {
      continue;
    }
    total += content.length;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) > 127) nonAscii++;
    }
  }
  return total === 0 ? 0 : nonAscii / total;
}
