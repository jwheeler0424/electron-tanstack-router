import { PGlite } from "@electric-sql/pglite";
import { drizzle, PgliteDatabase } from "drizzle-orm/pglite";
import path from "path";
import { DB_NAME } from "../constants/application";
import { generateDirPath, getUserDataPath } from "../utils";
import * as schema from "./schema";
const userDataPath = getUserDataPath();
const databasePath = path.join(userDataPath ?? __dirname, DB_NAME);
generateDirPath(databasePath);

// Postgres: Persist to the native filesystem
const pglite = new PGlite({ dataDir: databasePath });
const db: PgliteDatabase<typeof schema> = drizzle(pglite, {
  schema,
});

type Database = typeof PgliteDatabase<typeof schema>;

export { Database, db };
