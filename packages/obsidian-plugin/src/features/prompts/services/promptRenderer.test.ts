import { describe, expect, test } from "bun:test";
import {
  stripFrontmatter,
  stripArgDeclarations,
  substituteArgs,
  renderPrompt,
} from "./promptRenderer";

describe("stripFrontmatter", () => {
  test("returns content unchanged when no frontmatter", () => {
    const body = "Hello world";
    expect(stripFrontmatter(body)).toBe("Hello world");
  });

  test("strips well-formed frontmatter and returns body", () => {
    const content = "---\ntags: [mcp-tools-prompt]\n---\nHello world";
    expect(stripFrontmatter(content)).toBe("Hello world");
  });

  test("returns unchanged when --- opener has no closer", () => {
    const content = "---\nno closer";
    expect(stripFrontmatter(content)).toBe("---\nno closer");
  });

  test("keeps body after frontmatter including newlines", () => {
    const content = "---\ntitle: Test\n---\n\nFirst paragraph";
    expect(stripFrontmatter(content)).toBe("\nFirst paragraph");
  });
});

describe("stripArgDeclarations", () => {
  test("removes lines with two-arg tp.mcpTools.prompt call", () => {
    const body = `<% tp.mcpTools.prompt("name", "desc") %>\nHello {{name}}`;
    expect(stripArgDeclarations(body)).toBe("Hello {{name}}");
  });

  test("removes lines with one-arg tp.mcpTools.prompt call", () => {
    const body = `<% tp.mcpTools.prompt("topic") %>\nWrite about {{topic}}`;
    expect(stripArgDeclarations(body)).toBe("Write about {{topic}}");
  });

  test("handles <%* modifier form", () => {
    const body = `<%* tp.mcpTools.prompt("name", "desc") %>\nHello`;
    expect(stripArgDeclarations(body)).toBe("Hello");
  });

  test("handles <%- modifier form", () => {
    const body = `<%- tp.mcpTools.prompt("name", "desc") %>\nHello`;
    expect(stripArgDeclarations(body)).toBe("Hello");
  });

  test("keeps body lines unchanged", () => {
    const body = "First line\nSecond line";
    expect(stripArgDeclarations(body)).toBe("First line\nSecond line");
  });
});

describe("substituteArgs", () => {
  test("replaces known key with its value", () => {
    expect(substituteArgs("Hello {{name}}", { name: "Alice" })).toBe(
      "Hello Alice",
    );
  });

  test("leaves unknown key as-is", () => {
    expect(substituteArgs("Hello {{unknown}}", {})).toBe("Hello {{unknown}}");
  });

  test("makes no change when args map is empty", () => {
    const body = "No placeholders here";
    expect(substituteArgs(body, {})).toBe(body);
  });

  test("replaces multiple different keys", () => {
    const body = "{{greeting}} {{name}}!";
    expect(substituteArgs(body, { greeting: "Hi", name: "Bob" })).toBe(
      "Hi Bob!",
    );
  });

  test("trims whitespace inside braces when matching", () => {
    expect(substituteArgs("Hello {{ name }}", { name: "Alice" })).toBe(
      "Hello Alice",
    );
  });
});

describe("renderPrompt", () => {
  test("end-to-end: strips frontmatter + declarations + substitutes + trims leading blank lines", () => {
    const content = [
      "---",
      "tags: [mcp-tools-prompt]",
      "description: Greeting",
      "---",
      "",
      `<% tp.mcpTools.prompt("name", "Name to greet") %>`,
      "",
      "Hello {{name}}!",
    ].join("\n");

    const result = renderPrompt(content, { name: "World" });
    expect(result).toBe("Hello World!");
  });

  test("leaves Templater expressions verbatim", () => {
    const content = "---\ntags: [mcp-tools-prompt]\n---\n<% tp.date.now() %>";
    const result = renderPrompt(content, {});
    expect(result).toBe("<% tp.date.now() %>");
  });
});
