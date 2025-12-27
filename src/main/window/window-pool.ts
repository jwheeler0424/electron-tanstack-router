/**
 * window-pool.ts
 */
import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  ipcMain,
} from "electron";

export default class WindowPool {
  private browserOpts: BrowserWindowConstructorOptions;
  private loadTarget: string | (() => string);
  public available: BrowserWindow[] = [];
  private inUse: Set<BrowserWindow> = new Set();

  constructor(
    browserOpts: BrowserWindowConstructorOptions,
    loadTarget: string | (() => string)
  ) {
    this.browserOpts = browserOpts;
    this.loadTarget = loadTarget;

    this._createAndPrepare();
  }

  private async _createAndPrepare(): Promise<void> {
    const win = this._createWindow();
    this.available.push(win);
    const target =
      typeof this.loadTarget === "function"
        ? this.loadTarget()
        : this.loadTarget;
    try {
      await win.loadURL(target);
    } catch (e) {
      console.error("stop to load URL:", target);
    }
  }

  private _createWindow(): BrowserWindow {
    const opts: BrowserWindowConstructorOptions = {
      ...this.browserOpts,
      show: false,
    };
    const win = new BrowserWindow(opts);
    console.log("create ", win.id);

    win.once("closed", () => {
      console.log("closed", win.id, win.isDestroyed());
      this.inUse.delete(win);
      win.destroy?.();
    });

    return win;
  }

  public async acquire(): Promise<BrowserWindow> {
    if (this.available.length === 0) {
      await this._createAndPrepare();
    }

    const win = this.available.shift()!;

    this._createAndPrepare();

    this.inUse.add(win);
    win.show();
    return win;
  }

  public destroyAll(): void {
    this.available.forEach((w) => {
      if (!w.isDestroyed()) w.destroy();
    });
    this.inUse.forEach((w) => {
      if (!w.isDestroyed()) w.destroy();
    });
    this.available = [];
    this.inUse.clear();
  }
}

let pool: WindowPool;

export const initWindowPool = () => {
  pool = new WindowPool(
    { width: 800, height: 600, webPreferences: { nodeIntegration: true } },
    "about:blank"
  );
  ipcMain.handle("open-window", async () => {
    const win = await pool.acquire();
    return win.id;
  });
  return pool;
};

// Usage in main.ts
// import { app, ipcMain } from 'electron';
// import WindowPool from './window-pool';
//
// let pool: WindowPool;
// app.whenReady().then(() => {
//   pool = new WindowPool(
//     { width: 800, height: 600, webPreferences: { nodeIntegration: true } },
//     () => 'https://your-app-url'
//   );
// });
//
// ipcMain.handle('open-window', async () => {
//   const win = await pool.acquire();
//   win.once('close', () => pool.release(win));
//   return win.id;
// });
//
// app.on('before-quit', () => pool.destroyAll());
