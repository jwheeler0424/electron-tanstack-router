import { contextBridge, ipcRenderer } from "electron";
import { fsProxy } from "./modules/fs";
import { logger } from "./modules/logger";
import { update } from "./modules/update";
import { createWindow } from "./modules/window-pool";
import { auth } from "./services/auth";

export type Channels = "ipc-example";

const electronHandler = {
  env: process.env.NODE_ENV,
  health: () => ipcRenderer.invoke("health"),
  fs: fsProxy,
  update,
  logger,
  createWindow,
};
const electronServices = {
  auth,
};

const electronApi = {
  ...electronHandler,
  ...electronServices,
};

contextBridge.exposeInMainWorld("electron", electronApi);

export type ElectronHandler = typeof electronHandler;
