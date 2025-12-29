import {
  applyEnvDefaults,
  envSchema,
  type Env,
} from "../validation/env.schema";

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Environment validation failed:", result.error);
  process.exit(1);
}

export const appConfig: Env = applyEnvDefaults(result.data);
