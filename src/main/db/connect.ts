import { migrate } from "drizzle-orm/pglite/migrator";
import { app } from "electron";
import path from "path";
import { appConfig as config } from "../config/app.config";
import log from "../utils/logger";
import { db } from "./drizzle";

export const connect = async () => {
  log.info("Database", config.NODE_ENV);
  log.info("Database", path.join(app.getAppPath(), "migrations"));
  try {
    await migrate(db, {
      migrationsFolder: path.join(app.getAppPath(), "migrations"),
    });
  } catch (e) {
    log.error("Database connection error ", e);
  }
  await testConnection();
};

async function testConnection() {
  try {
    // Execute a simple query to check the connection
    await db.execute(`select 1`);
    log.info("Database connection successful.");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    return false;
  } finally {
    // Optional: End the client connection if it's a script or one-off check
    // For long-running applications (like a server), you typically keep the connection open
  }
}
