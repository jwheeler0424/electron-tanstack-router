import { ipcRenderer } from "electron";

export const auth = {
  insertTODO: (todo: TODO) => ipcRenderer.invoke("todo:insert", todo),
  deleteTODO: (id: number) => ipcRenderer.invoke("todo:delete", id),
  getAllTODO: () => ipcRenderer.invoke("todo:getAll"),
  getOneTODO: (id: number) => ipcRenderer.invoke("todo:getOne", id),
  updateTODO: (todo: TODO) => ipcRenderer.invoke("todo:update", todo),
};
