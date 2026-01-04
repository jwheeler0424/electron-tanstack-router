import { ipcRenderer } from "electron";
import { UPDATE_CHANNEL } from "../../constants/application";

export const update = {
  onUpdateMsg: (callback: (response: any) => void) => {
    ipcRenderer.send(UPDATE_CHANNEL.MSG);
    ipcRenderer.on(UPDATE_CHANNEL.MSG, (_, response) => callback(response));
  },
  onUpdateAvailable: (callback: (response: any) => void) => {
    ipcRenderer.on(UPDATE_CHANNEL.CHECK_UPDATE, (_, response) =>
      callback(response)
    );
  },
  onUpdateProgress: (callback: (response: any) => void) => {
    ipcRenderer.on(UPDATE_CHANNEL.PROGRESS, (_, response) =>
      callback(response)
    );
  },
  onUpdateCompleted: (callback: (response: any) => void) => {
    ipcRenderer.on(UPDATE_CHANNEL.COMPLETED, (_, response) =>
      callback(response)
    );
  },
  onUpdateError: (callback: (response: any) => void) => {
    ipcRenderer.on(UPDATE_CHANNEL.ERROR, (_, response) => callback(response));
  },
  setUrl: async (url: string) =>
    await ipcRenderer.invoke(UPDATE_CHANNEL.SET_URL, url),
  checkUpdate: () => ipcRenderer.send(UPDATE_CHANNEL.CHECK_UPDATE),
  cancelUpdate: () => ipcRenderer.send(UPDATE_CHANNEL.CANCEL_UPDATE),
  startDownload: () => ipcRenderer.send(UPDATE_CHANNEL.START_DOWNLOAD),
  quitAndInstall: () => ipcRenderer.send(UPDATE_CHANNEL.QUIT_AND_INSTALL),
};
