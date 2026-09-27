export const settings = {
  appName: "Graph8 Revenue Learning",
  environment: process.env.ENVIRONMENT || process.env.NODE_ENV || "development",

  jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
  accessTokenExpireMinutes: 60 * 24,

  secretEncryptionKey: process.env.SECRET_ENCRYPTION_KEY || "0".repeat(44),

  graph8ApiKey: process.env.GRAPH8_API_KEY || null,
  graph8BaseUrl: process.env.GRAPH8_BASE_URL || "https://be.graph8.com/api/v1",
  graph8WebhookSecret: process.env.GRAPH8_WEBHOOK_SECRET || null,

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  llmModel: process.env.LLM_MODEL || "claude-sonnet-5",
  analysisPromptVersion: "v1",
  taxonomyVersion: "v1",

  patternMinSampleSize: 3,
  patternRecurringThreshold: 5,
  patternStrongThreshold: 8,
};
