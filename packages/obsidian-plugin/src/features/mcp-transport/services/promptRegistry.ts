import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

export type PromptListEntry = {
  name: string;
  description?: string;
  arguments: Array<{ name: string; description: string; required: false }>;
};

export type PromptGetResult = {
  messages: [{ role: "user"; content: { type: "text"; text: string } }];
};

type PromptHandler = (
  name: string,
  args: Record<string, string>,
) => Promise<PromptGetResult>;

export class PromptRegistryClass {
  private lister: () => Promise<PromptListEntry[]> = async () => [];
  private handler: PromptHandler | null = null;

  setLister(fn: () => Promise<PromptListEntry[]>): void {
    this.lister = fn;
  }

  setHandler(_name: "*", fn: PromptHandler): void {
    this.handler = fn;
  }

  list = async (): Promise<{ prompts: PromptListEntry[] }> => ({
    prompts: await this.lister(),
  });

  dispatch = async (params: {
    name: string;
    arguments?: Record<string, string>;
  }): Promise<PromptGetResult> => {
    if (!this.handler) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Prompt not found: ${params.name}`,
      );
    }
    return this.handler(params.name, params.arguments ?? {});
  };
}

export type PromptRegistry = PromptRegistryClass;
