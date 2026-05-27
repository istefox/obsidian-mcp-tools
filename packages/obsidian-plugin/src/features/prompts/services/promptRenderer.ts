export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return content;
  return content.slice(end + 5);
}

export function stripArgDeclarations(body: string): string {
  return body
    .split("\n")
    .filter((line) => !/^\s*<%[-*]?\s*tp\.mcpTools\.prompt\(/.test(line))
    .join("\n");
}

export function substituteArgs(
  body: string,
  args: Record<string, string>,
): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    return trimmed in args ? args[trimmed] : `{{${key}}}`;
  });
}

export function renderPrompt(
  content: string,
  args: Record<string, string>,
): string {
  const stripped = stripFrontmatter(content);
  const noDeclarations = stripArgDeclarations(stripped);
  const substituted = substituteArgs(noDeclarations, args);
  return substituted.replace(/^\n+/, "");
}
