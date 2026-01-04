import Electron, { app, ipcMain } from "electron";
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater";
import { autoUpdater, CancellationToken } from "electron-updater";
import { UPDATE_CHANNEL, UPDATE_CODE } from "../../constants/application";
import logger from "../utils/logger";
import { response } from "../utils/response";

let webContents: Electron.WebContents | null = null;
const cancellationToken = new CancellationToken();

export function update(window: Electron.BrowserWindow) {
  // When set to false, the update download will be triggered through the API
  autoUpdater.autoDownload = false;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.allowDowngrade = false;

  logger.transports.file.level = "info";
  autoUpdater.logger = logger;

  // start check
  autoUpdater.on("checking-for-update", function () {
    window.webContents.send(
      UPDATE_CHANNEL.CHECK_UPDATE,
      response.ok({
        msg: "Checking for update...",
        data: {
          status: UPDATE_CODE.checking,
        },
      })
    );
    window.webContents.send(
      UPDATE_CHANNEL.MSG,
      response.ok({
        data: {
          status: UPDATE_CODE.checking,
        },
      })
    );
  });

  // update available
  autoUpdater.on("update-available", (arg: UpdateInfo) => {
    window.webContents.send(
      UPDATE_CHANNEL.CHECK_UPDATE,
      response.ok({
        msg: "A new version is available",
        data: {
          update: true,
          version: app.getVersion(),
          newVersion: arg?.version,
          status: UPDATE_CODE.updateAvaible,
        },
      })
    );
    window.webContents.send(
      UPDATE_CHANNEL.MSG,
      response.ok({
        data: {
          status: UPDATE_CODE.updateAvaible,
        },
      })
    );
  });
  // update not available
  autoUpdater.on("update-not-available", (arg: UpdateInfo) => {
    window.webContents.send(
      UPDATE_CHANNEL.CHECK_UPDATE,
      response.ok({
        msg: "You are using the latest version",
        data: {
          update: false,
          version: app.getVersion(),
          newVersion: arg?.version,
          status: UPDATE_CODE.updateNotAvaible,
        },
      })
    );
    window.webContents.send(
      UPDATE_CHANNEL.MSG,
      response.ok({
        data: {
          status: UPDATE_CODE.updateNotAvaible,
        },
      })
    );
  });

  // Checking for updates
  ipcMain.handle(UPDATE_CHANNEL.CHECK_UPDATE, async () => {
    if (!app.isPackaged) {
      const error = new Error(
        "The update feature is only available after the package."
      );
      window.webContents.send(
        UPDATE_CHANNEL.ERROR,
        response.error({
          msg: error.message,
          data: {
            status: UPDATE_CODE.error,
          },
          error,
        })
      );
      window.webContents.send(
        UPDATE_CHANNEL.MSG,
        response.error({
          error,
          data: {
            status: UPDATE_CODE.error,
            error: error.message,
          },
        })
      );
      return;
    }

    try {
      const result = await autoUpdater.checkForUpdatesAndNotify();
      window.webContents.send(
        UPDATE_CHANNEL.CHECK_UPDATE,
        response.ok({
          data: {
            ...result?.updateInfo,
            status: result?.updateInfo.version
              ? UPDATE_CODE.updateAvaible
              : UPDATE_CODE.updateNotAvaible,
          },
        })
      );
      window.webContents.send(
        UPDATE_CHANNEL.MSG,
        response.ok({
          data: {
            ...result,
            status: result?.updateInfo.version
              ? UPDATE_CODE.updateAvaible
              : UPDATE_CODE.updateNotAvaible,
          },
        })
      );
      return;
    } catch (error) {
      window.webContents.send(
        UPDATE_CHANNEL.ERROR,
        response.error({
          data: {
            status: UPDATE_CODE.error,
          },
          error,
        })
      );
      window.webContents.send(
        UPDATE_CHANNEL.MSG,
        response.error({
          error,
          data: {
            status: UPDATE_CODE.error,
            error: (error as Error).message,
          },
        })
      );
      return;
    }
  });

  // Start downloading and feedback on progress
  ipcMain.handle(
    UPDATE_CHANNEL.START_DOWNLOAD,
    (event: Electron.IpcMainInvokeEvent) => {
      startDownload(
        (error, progressInfo) => {
          if (error) {
            // feedback download error message
            event.sender.send(
              UPDATE_CHANNEL.ERROR,
              response.error({
                error,
                data: {
                  status: UPDATE_CODE.error,
                },
              })
            );
            webContents?.send(
              UPDATE_CHANNEL.MSG,
              response.error({
                error,
                data: {
                  status: UPDATE_CODE.error,
                  error: error.message,
                },
              })
            );
          } else {
            // feedback update progress message
            event.sender.send(
              UPDATE_CHANNEL.PROGRESS,
              response.ok({
                data: { ...progressInfo, status: UPDATE_CODE.downloadProgress },
              })
            );
            webContents?.send(
              UPDATE_CHANNEL.MSG,
              response.ok({
                data: {
                  status: UPDATE_CODE.downloadProgress,
                  ...progressInfo,
                },
              })
            );
          }
        },
        () => {
          // feedback update downloaded message
          event.sender.send(
            UPDATE_CHANNEL.COMPLETED,
            response.ok({
              data: {
                status: UPDATE_CODE.updateDownloaded,
              },
            })
          );
          webContents?.send(
            UPDATE_CHANNEL.MSG,
            response.ok({
              data: {
                status: UPDATE_CODE.updateDownloaded,
              },
            })
          );
        }
      );
    }
  );

  // Install now
  ipcMain.handle(UPDATE_CHANNEL.QUIT_AND_INSTALL, () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle(
    UPDATE_CHANNEL.CANCEL_UPDATE,
    (event: Electron.IpcMainInvokeEvent) => {
      try {
        cancellationToken.cancel();
        event.sender.send(
          UPDATE_CHANNEL.MSG,
          response.ok({
            msg: "Update cancelled by user.",
            data: {
              status: UPDATE_CODE.updateCancelled,
            },
          })
        );
        event.sender.send(
          UPDATE_CHANNEL.CANCEL_UPDATE,
          response.ok({
            msg: "Update cancelled by user.",
            data: {
              status: UPDATE_CODE.updateCancelled,
            },
          })
        );
      } catch (error) {
        event.sender.send(
          UPDATE_CHANNEL.ERROR,
          response.error({
            error,
            data: {
              status: UPDATE_CODE.error,
            },
          })
        );
        event.sender.send(
          UPDATE_CHANNEL.MSG,
          response.error({
            error,
            data: {
              status: UPDATE_CODE.error,
              error: (error as Error).message,
            },
          })
        );
      }
    }
  );
}

function startDownload(
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void
) {
  autoUpdater.on("download-progress", (info: ProgressInfo) =>
    callback(null, info)
  );
  autoUpdater.on("error", (error: Error) => callback(error, null));
  autoUpdater.on("update-downloaded", complete);
  autoUpdater.downloadUpdate();
}

ipcMain.on(UPDATE_CHANNEL.MSG, async (event, message) => {
  webContents = event.sender;
});

const sendResponse = (status: keyof typeof response, data?: any) => {
  webContents?.send?.(UPDATE_CHANNEL.MSG, response[status](data));
};
