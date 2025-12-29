import { defineConfig } from "drizzle-kit";
import { existsSync, mkdirSync } from "fs";
import path, { dirname } from "path";
import { getUserDataPath } from "src/main/utils";
import { DB_NAME } from "./src/main/constants/application";

const userDataPath = getUserDataPath();
const databasePath = path.join(userDataPath ?? __dirname, DB_NAME);

const generateDbPath = (dirString: string) => {
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
  driver: "pglite",
  dbCredentials: {
    url: databasePath,
  },
});
