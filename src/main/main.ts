/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  shell,
  Tray,
} from "electron";
import debug from "electron-debug";
import path from "path";
import sourceMapSupport from "source-map-support";
import "./auto-update/index";
import { init } from "./db/init";
import logger from "./logger";
import MenuBuilder from "./menu";
import WindowPool, { initWindowPool } from "./window/window-pool";

// import {
//   deleteTODO,
//   getAllTODO,
//   getOneTODO,
//   insertTODO,
//   updateTODO,
//   TODO,
// } from './services/Database.service';

let windowPool: WindowPool;
let mainWindow: BrowserWindow | null = null;

ipcMain.on("ipc-example", async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply("ipc-example", msgTemplate("pong"));
});

if (process.env.NODE_ENV === "production") {
  sourceMapSupport.install();
}

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath)
  : path.join(__dirname, "../../");

const isDebug =
  process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

const createWindow = async () => {
  if (isDebug) {
    debug();
  }
  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, "assets", ...paths);
  };

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    center: true,
    icon: getAssetPath("icons", "tray.png"),
    // titleBarStyle: 'hidden',
    webPreferences: {
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
  if (isDebug) {
    mainWindow?.webContents.openDevTools();
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": ["script-src 'unsafe-inline' 'self'"],
      },
    });
  });

  Menu.setApplicationMenu(null);

  mainWindow.on("ready-to-show", () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: "deny" };
  });
};

/**
 * Add event listeners...
 */
app
  .whenReady()
  .then(async () => {
    logger.info("main init");
    await init();
    createWindow();
    addTray();
    windowPool = initWindowPool();
    app.on("activate", () => {
      // macOS
      if (BrowserWindow.getAllWindows().length === windowPool.available?.length)
        createWindow();
    });
    // ipcMain.handle('todo:insert', async (_, todo: TODO) => {
    //   insertTODO(todo);
    // });
    // ipcMain.handle('todo:update', async (_, todo: TODO) => {
    //   updateTODO(todo);
    // });
    // ipcMain.handle('todo:delete', async (_, id: number) => {
    //   deleteTODO(id);
    // });
    // ipcMain.handle('todo:getOne', async (_, id: number) => {
    //   return getOneTODO(id);
    // });
    // ipcMain.handle('todo:getAll', async () => {
    //   return getAllTODO();
    // });
  })
  .catch(logger.error);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => windowPool.destroyAll());

let tray;

const addTray = () => {
  const iconPath = path.join(RESOURCES_PATH, "./assets/icons/tray.png");
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: "Exit", click: () => app.quit() },
  ]);
  tray.setToolTip("Test App");
  tray.setContextMenu(contextMenu);
};
