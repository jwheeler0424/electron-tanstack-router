import { migrate } from "drizzle-orm/pglite/migrator";
import path from "path";
import log from "../logger";
import { db } from "./drizzle";

export const connect = async () => {
  log.info("Database", process.env.NODE_ENV);
  log.info("Database", path.join(__dirname, "../../migrations"));
  if (process.env.NODE_ENV === "production") {
    try {
      await migrate(db, {
        migrationsFolder: path.join(__dirname, "../../migrations"),
      });
    } catch (e) {
      log.error("Database connection error ", e);
    }
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
