import type { EmbeddingProvider } from "../types";
import type { PipelineFactory } from "./embedder";
import { createTransformersProvider } from "./transformersProvider";

export function createMultilingualE5Provider(
  pipelineFactory: PipelineFactory,
): EmbeddingProvider {
  return createTransformersProvider({
    modelId: "Xenova/multilingual-e5-base",
    providerKey: "multilingual-e5-base",
    dimensions: 768,
    maxInputTokens: 512,
    modelSizeBytes: 100_000_000,
    taskPrompt: (text, role) =>
      (role === "query" ? "query: " : "passage: ") + text,
    pipelineFactory,
  });
}
