import { defineConfig } from "drizzle-kit";
import { existsSync, mkdirSync } from "fs";
import path, { dirname } from "path";
import { APP_NAME, DB_CONFIG } from "./src/main/utils/constants";

const databasePath = path.join(
  process.env.APPDATA ?? "",
  APP_NAME,
  DB_CONFIG.dbFileName
);

const generateDbPath = (dirString: string) => {
  console.warn("databasePath: ", databasePath);
  try {
    const dir = dirname(dirString);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

generateDbPath(databasePath);
// console.log('databasePath', databasePath);

export default defineConfig({
  dialect: "postgresql", // "mysql" | "sqlite" | "postgresql" | "turso" | "singlestore"
  schema: "./src/main/db/schema",
  out: "./migrations",
  dbCredentials: {
    url: databasePath,
  },
});
