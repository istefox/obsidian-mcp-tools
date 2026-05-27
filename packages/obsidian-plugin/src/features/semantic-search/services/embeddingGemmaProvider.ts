import type { EmbeddingProvider } from "../types";
import type { PipelineFactory } from "./embedder";
import { createTransformersProvider } from "./transformersProvider";

export function createEmbeddingGemmaProvider(
  pipelineFactory: PipelineFactory,
): EmbeddingProvider {
  return createTransformersProvider({
    modelId: "onnx-community/embeddinggemma-300m-ONNX",
    providerKey: "embedding-gemma-300m",
    dimensions: 768,
    maxInputTokens: 2048,
    modelSizeBytes: 190_000_000,
    taskPrompt: (text, role) =>
      role === "query"
        ? "task: search result | query: " + text
        : "title: none | text: " + text,
    pipelineFactory,
  });
}
