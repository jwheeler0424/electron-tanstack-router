// // main.js
// import { app, BrowserWindow, Menu, Tray } from "electron";
// import path from "path";

// // handler
// import dotenv from "dotenv";
// import "./auto-update/index";
// import { init } from "./db/init";
// import logger from "./logger";
// import { getDirname } from "./utils";
// import WindowPool, { initWindowPool } from "./window/window-pool";
// const __dirname = getDirname(import.meta.url);

// const envFile = `.env.${process.env.NODE_ENV || "development"}`;
// dotenv.config({ path: path.resolve(__dirname, "../../", envFile) });
// /**
//  * asar, dist, dist-electron,
//  * electron-builder files
//  */
// const rootDir = path.join(__dirname, "../../");

// const electronDist = path.join(__dirname, "../../dist");

// const preloadDir = path.join(__dirname, "../preload");
// let windowPool: WindowPool;
// let mainWindow;
// const createWindow = () => {
//   const iconPath = path.join(rootDir, "./assets/icons/tray.png");

//   mainWindow = new BrowserWindow({
//     width: 1000,
//     height: 600,
//     center: true,
//     icon: iconPath,
//     // titleBarStyle: 'hidden',
//     webPreferences: {
//       preload: path.join(preloadDir, "index.js"),
//       sandbox: false,
//       nodeIntegration: false, // nodeIntegration
//       contextIsolation: true, // contextIsolation
//     },
//   });
//   if (process.env.VITE_DEV_SERVER_URL) {
//     mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
//   } else {
//     mainWindow.loadFile(path.resolve(rootDir, "./index.html"));
//   }

//   Menu.setApplicationMenu(null);

//   mainWindow.webContents.openDevTools();
// };

// // Electron
// // API : ready
// app.whenReady().then(async () => {
//   logger.info("main init");
//   await init();
//   createWindow();
//   addTray();
//   windowPool = initWindowPool();
//   app.on("activate", () => {
//     // macOS
//     if (BrowserWindow.getAllWindows().length === windowPool.available?.length)
//       createWindow();
//   });
// });

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") app.quit();
// });
// app.on("before-quit", () => windowPool.destroyAll());

// let tray;

// const addTray = () => {
//   const iconPath = path.join(rootDir, "./assets/icons/tray.png");
//   tray = new Tray(iconPath);
//   const contextMenu = Menu.buildFromTemplate([
//     { label: "Exit", click: () => app.quit() },
//   ]);
//   tray.setToolTip("Test App");
//   tray.setContextMenu(contextMenu);
// };
