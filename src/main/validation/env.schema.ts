import * as z from "zod/mini";
import { NullableSchema, UrlSchema } from "./common.schema";

const NodeEnvSchema = z
  .string()
  .check(z.trim(), z.regex(/^(development|production|test)$/));

export const envSchema = z.object({
  NODE_ENV: z.union([NodeEnvSchema, NullableSchema]),
  DEBUG_PROD: z.union([z.string(), NullableSchema]),
  START_MINIMIZED: z.union([z.boolean(), NullableSchema]),

  /* Database Tokens */
  DATABASE_URL: z.union([UrlSchema, NullableSchema]),

  /* Auth Tokens */
  ACCESS_TOKEN_SECRET: z.union([z.string(), NullableSchema]),
  REFRESH_TOKEN_SECRET: z.union([z.string(), NullableSchema]),
});

export function applyEnvDefaults(env: z.infer<typeof envSchema>) {
  return {
    NODE_ENV: env.NODE_ENV ?? "development",
    DEBUG_PROD: env.DEBUG_PROD ?? "false",
    START_MINIMIZED: env.START_MINIMIZED ?? false,
    DATABASE_URL: env.DATABASE_URL,
    ACCESS_TOKEN_SECRET: env.ACCESS_TOKEN_SECRET ?? "your_access_token_secret",
    REFRESH_TOKEN_SECRET:
      env.REFRESH_TOKEN_SECRET ?? "your_refresh_token_secret",
  };
}

export type Env = ReturnType<typeof applyEnvDefaults>;
