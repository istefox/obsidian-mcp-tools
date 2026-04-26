import fsp from "fs/promises";
import os from "os";
import path from "path";
import { logger } from "$/shared/logger";
import { CLAUDE_CONFIG_PATH } from "../constants";

// NOTE: this module deliberately does NOT import from "obsidian".
// The `plugin` parameter on `updateClaudeConfig` is unused in the
// function body (kept for signature compatibility with callers) and
// its type is widened to `unknown` below. Avoiding the "obsidian"
// import makes this file loadable from unit tests — the package
// ships only .d.ts files and has no runtime JS, so any test that
// imports a module referencing it crashes with
// `Cannot find package 'obsidian'`.

interface ClaudeConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: {
        OBSIDIAN_API_KEY?: string;
        [key: string]: string | undefined;
      };
    };
  };
}

/**
 * Gets the absolute path to the Claude Desktop config file. Exported
 * so `uninstall.ts` can share the same platform-aware resolution
 * instead of hardcoding the macOS location. See issue in CLAUDE.md
 * open bugs: previously uninstall.ts used a literal macOS path,
 * which silently failed to clean up the config entry on Linux and
 * Windows.
 */
export function getConfigPath(): string {
  const platform = os.platform();
  let configPath: string;

  switch (platform) {
    case "darwin":
      configPath = CLAUDE_CONFIG_PATH.macos;
      break;
    case "win32":
      configPath = CLAUDE_CONFIG_PATH.windows;
      break;
    default:
      configPath = CLAUDE_CONFIG_PATH.linux;
  }

  // Expand ~ to home directory if needed
  if (configPath.startsWith("~")) {
    configPath = path.join(os.homedir(), configPath.slice(1));
  }

  // Expand environment variables on Windows
  if (platform === "win32") {
    configPath = configPath.replace(/%([^%]+)%/g, (_, n) => process.env[n] || "");
  }

  return configPath;
}

/**
 * Updates the Claude Desktop config file with MCP server settings.
 *
 * @param plugin - The Obsidian plugin instance (unused today, kept
 *   for signature compatibility with other callers).
 * @param serverPath - Absolute path to the installed server binary.
 * @param apiKey - Local REST API key, written as OBSIDIAN_API_KEY.
 * @param extraEnv - Optional additional env vars merged into the env
 *   block. Values take precedence over nothing (apiKey is written
 *   separately under a fixed key). Keeping this as a plain record
 *   avoids cross-feature imports into this file — feature-specific
 *   serialization stays in the caller.
 */
export async function updateClaudeConfig(
  plugin: unknown,
  serverPath: string,
  apiKey?: string,
  extraEnv?: Record<string, string>,
): Promise<void> {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);

    // Defensive logging: capture the inputs every time. Tracking down
    // user reports that "the config is empty after Install" requires
    // knowing what was actually called and with what arguments. We
    // never log the apiKey itself — only its presence and length —
    // because it is a credential.
    logger.info("updateClaudeConfig: invoked", {
      configPath,
      serverPathLength: serverPath?.length ?? 0,
      hasServerPath: typeof serverPath === "string" && serverPath.length > 0,
      hasApiKey: typeof apiKey === "string" && apiKey.length > 0,
      apiKeyLength: apiKey?.length ?? 0,
      extraEnvKeys: extraEnv ? Object.keys(extraEnv) : [],
    });

    // Ensure config directory exists
    await fsp.mkdir(configDir, { recursive: true });

    // Read existing config or create new one
    let config: ClaudeConfig = { mcpServers: {} };
    let preExistingMcpServerKeys: string[] = [];
    let fileExistedBefore = false;
    try {
      const content = await fsp.readFile(configPath, "utf8");
      fileExistedBefore = true;
      config = JSON.parse(content);
      config.mcpServers = config.mcpServers || {};
      preExistingMcpServerKeys = Object.keys(config.mcpServers);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // SyntaxError on JSON.parse, EACCES, EISDIR, etc. — log the
        // shape so diagnosis does not require attaching to the actual
        // user's machine. Then propagate (caller decides how to recover).
        logger.error("updateClaudeConfig: failed to read existing config", {
          configPath,
          errorName: error instanceof Error ? error.name : "Unknown",
          errorCode: (error as NodeJS.ErrnoException).code,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      // File doesn't exist, use default empty config
      logger.debug("updateClaudeConfig: config file did not exist, will create", {
        configPath,
      });
    }

    if (fileExistedBefore) {
      logger.debug("updateClaudeConfig: read existing config", {
        configPath,
        preExistingMcpServerKeys,
        hadOurEntryAlready: preExistingMcpServerKeys.includes(
          "obsidian-mcp-tools",
        ),
      });
    }

    // Update config with our server entry. Any extra env vars are
    // merged in alongside OBSIDIAN_API_KEY.
    config.mcpServers["obsidian-mcp-tools"] = {
      command: serverPath,
      env: {
        OBSIDIAN_API_KEY: apiKey,
        ...extraEnv,
      },
    };

    const finalKeys = Object.keys(config.mcpServers);

    // Write updated config
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
    // Defensive: log the post-write shape so a user reporting "the
    // entry is missing after Install" can be cross-checked against
    // what the writer actually persisted in the same process tick.
    logger.info("updateClaudeConfig: wrote config", {
      configPath,
      mcpServerKeysAfter: finalKeys,
      ourEntryWritten: finalKeys.includes("obsidian-mcp-tools"),
      ourCommandLength:
        config.mcpServers["obsidian-mcp-tools"]?.command?.length ?? 0,
    });
  } catch (error) {
    logger.error("Failed to update Claude config:", { error });
    throw new Error(
      `Failed to update Claude config: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Removes the MCP server entry from the Claude Desktop config file
 */
export async function removeFromClaudeConfig(): Promise<void> {
  try {
    const configPath = getConfigPath();

    // Read existing config
    let config: ClaudeConfig;
    try {
      const content = await fsp.readFile(configPath, "utf8");
      config = JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, nothing to remove
        return;
      }
      throw error;
    }

    // Remove our server entry if it exists
    if (config.mcpServers && "obsidian-mcp-tools" in config.mcpServers) {
      delete config.mcpServers["obsidian-mcp-tools"];
      await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
      logger.info("Removed server from Claude config", { configPath });
    }
  } catch (error) {
    logger.error("Failed to remove from Claude config:", { error });
    throw new Error(
      `Failed to remove from Claude config: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
