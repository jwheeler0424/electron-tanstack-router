import { contextBridge } from "electron";
import { api } from "./modules/api";
import { fetch } from "./modules/fetch";
import { fsProxy } from "./modules/fs";
import { logger } from "./modules/logger";
import { update } from "./modules/update";
import { createWindow } from "./modules/window-pool";
import { auth } from "./services/auth";

export type Channels = "ipc-example";

const electronHandler = {
  env: process.env.NODE_ENV,
  api,
  fetch,
  fs: fsProxy,
  update,
  logger,
  createWindow,
  // insertTODO: (todo: TODO) => ipcRenderer.invoke('todo:insert', todo),
  // deleteTODO: (id: number) => ipcRenderer.invoke('todo:delete', id),
  // getAllTODO: () => ipcRenderer.invoke('todo:getAll'),
  // getOneTODO: (id: number) => ipcRenderer.invoke('todo:getOne', id),
  // updateTODO: (todo: TODO) => ipcRenderer.invoke('todo:update', todo),
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
