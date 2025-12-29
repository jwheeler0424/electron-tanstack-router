import { contextBridge } from "electron";
import { api } from "./modules/api";
import { fsProxy } from "./modules/fs";
import { logger } from "./modules/logger";
import { update } from "./modules/update";
import { createWindow } from "./modules/window-pool";

export type Channels = "ipc-example";

const electronHandler = {
  env: process.env.NODE_ENV,
  api,
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

contextBridge.exposeInMainWorld("electron", electronHandler);

export type ElectronHandler = typeof electronHandler;
