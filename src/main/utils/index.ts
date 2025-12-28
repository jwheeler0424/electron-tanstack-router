import { app } from "electron";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import logger from "../logger";

export const getAppHand = () => {
  return app.getPath("appData");
};

export const getUserDataPath = () => {
  return app ? app.getPath("userData") : path.join(process.cwd(), "userData");
};

export const getResourcePath = () => {
  return process.resourcesPath;
};

export const isMac = () => {
  return process.platform === "darwin";
};

export const isDev = process.env.NODE_ENV === "development";
// export const isProd = process.env.NODE_ENV === "production";

export const generateDirPath = (dirString: string) => {
  try {
    const dir = path.dirname(dirString);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    logger.error("Database connection error:", error);
    throw error;
  }
};
