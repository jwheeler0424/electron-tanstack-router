import { contextBridge } from "electron";
import { queryDB } from "./modules/db";
import { fsProxy } from "./modules/fs";
import { logger } from "./modules/logger";
import { update } from "./modules/update";
import { createWindow } from "./modules/window-pool";
/**
 * window.electronAPI
 */
contextBridge.exposeInMainWorld("electronAPI", {
  queryDB: queryDB,
  env: process.env.NODE_ENV,
  fs: fsProxy,
  update,
  logger,
  createWindow,
});
