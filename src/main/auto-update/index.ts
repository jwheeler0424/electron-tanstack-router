import Electron, { ipcMain } from "electron";
import updater from "electron-updater";
import { UPDATE_CHANNEL, UPDATE_CODE } from "../utils/constants";
const { autoUpdater } = updater;
let webContents: Electron.WebContents | null = null;

autoUpdater.forceDevUpdateConfig = false;
autoUpdater.autoDownload = false;

autoUpdater.on("error", (err) => sendStatus(UPDATE_CODE.error, err.message));
autoUpdater.on("checking-for-update", () => sendStatus(UPDATE_CODE.checking));
autoUpdater.on("update-available", () => sendStatus(UPDATE_CODE.updateAvaible));
autoUpdater.on("update-not-available", () =>
  sendStatus(UPDATE_CODE.updateNotAvaible)
);
autoUpdater.on("download-progress", (p) =>
  sendStatus(UPDATE_CODE.downloadProgress, p)
);
autoUpdater.on("update-downloaded", () =>
  sendStatus(UPDATE_CODE.updateDownloaded)
);

const sendStatus = (code: number, data?: any) => {
  webContents?.send?.(UPDATE_CHANNEL.MSG, { code, data });
};

ipcMain.on(UPDATE_CHANNEL.MSG, async (event, message) => {
  webContents = event.sender;
});

ipcMain.handle(UPDATE_CHANNEL.SET_URL, (e, url) => autoUpdater.setFeedURL(url));

ipcMain.on(UPDATE_CHANNEL.CHECK_UPDATE, () => autoUpdater.checkForUpdates());

ipcMain.on(UPDATE_CHANNEL.DOWNLOAD_UPDATE, async (e, data) =>
  autoUpdater.downloadUpdate()
);

ipcMain.on(UPDATE_CHANNEL.EXIT_AND_INSTALL, () => autoUpdater.quitAndInstall());
