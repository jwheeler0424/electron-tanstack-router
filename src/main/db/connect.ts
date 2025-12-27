import { migrate } from "drizzle-orm/pglite/migrator";
import path from "path";
import log from "../logger";
import { getDirname } from "../utils";
import { db } from "./drizzle";
const __dirname = getDirname(import.meta.url);

export const connect = async () => {
  log.info("Database connection", process.env.NODE_ENV);
  log.info("Database connection", path.join(__dirname, "../../../migrations"));
  if (process.env.NODE_ENV === "production") {
    try {
      await migrate(db, {
        migrationsFolder: path.join(__dirname, "../../../migrations"),
      });
    } catch (e) {
      log.error("Database connection error ", e);
    }
  }
};
