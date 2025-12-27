import { PGlite } from "@electric-sql/pglite";
import { drizzle, PgliteDatabase } from "drizzle-orm/pglite";
import path from "path";
import { generateDirPath, getAppHand } from "../utils";
import { APP_NAME, DB_NAME } from "../utils/constants";
import * as schema from "./schema";

const DB_PATH = path.join(getAppHand(), APP_NAME, DB_NAME);
generateDirPath(DB_PATH);

// Postgres: Persist to the native filesystem
const pglite = new PGlite(DB_PATH);
const db: PgliteDatabase<typeof schema> = drizzle(pglite, {
  schema,
});

type Database = typeof PgliteDatabase<typeof schema>;

export { Database, db };
