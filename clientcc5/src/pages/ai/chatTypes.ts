/** Shape of the assistant's reply. Mirrors ChatResponseDto on the server. */
export type ChatResponse = {
  message: string;
  intent?: string;
  suggestedActions?: string[];
  contextData?: unknown;
  requiresConfirmation?: boolean;
};

/**
 * What the server actually sent to the model with the question.
 *
 * `usedFallbackModel` is true when the configured model was rate limited and the
 * server retried on the rate-limit fallback model. Surfaced because a silent swap
 * would leave the reader believing the configured model produced the answer.
 */
export type ChatContextData = {
  dossierCharacters?: number;
  modelUsed?: string;
  usedFallbackModel?: boolean;
};

export function chatContext(result: ChatResponse | null): ChatContextData | null {
  const data = result?.contextData;
  return data && typeof data === "object" ? (data as ChatContextData) : null;
}

/** True when the reply is an error rather than an answer. */
export function isChatError(result: ChatResponse | null): boolean {
  return !!result && result.intent === "error";
}
