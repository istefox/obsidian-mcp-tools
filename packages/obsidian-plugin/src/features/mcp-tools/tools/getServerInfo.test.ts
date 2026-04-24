import { describe, expect, test } from "bun:test";
import { getServerInfoHandler, getServerInfoSchema } from "./getServerInfo";

describe("get_server_info tool", () => {
  test("schema declares the tool name", () => {
    const name = getServerInfoSchema.get("name");
    expect(name?.toString()).toContain("get_server_info");
  });

  test("handler returns status + version in an MCP content block", async () => {
    const result = await getServerInfoHandler({
      arguments: {},
      pluginVersion: "0.4.0-alpha.1",
    });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text as string);
    expect(parsed.status).toBe("ok");
    expect(parsed.version).toBe("0.4.0-alpha.1");
    expect(parsed.transport).toBe("streamable-http");
  });
});
