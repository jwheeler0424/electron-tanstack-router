interface QueryDBType {
  path: string;
  params?: Record<string, any>;
  timeout?: number;
}

interface fsProxy {
  readFile: typeof fs.readFile;
  writeFile: typeof fs.writeFile;
  appendFile: typeof fs.appendFile;
  mkdir: typeof fs.mkdir;
  readdir: typeof fs.readdir;
  stat: typeof fs.stat;
  rmdir: typeof fs.rmdir;
  rename: typeof fs.rename;
  copyFile: typeof fs.copyFile;
  access: typeof fs.access;
  chmod: typeof fs.chmod;
  chown: typeof fs.chown;
  fstat: typeof fs.fstat;
}

interface AppUpdate {
  onUpdateMsg: (callback: (response: any) => void) => void;
  onUpdateAvailable: (callback: (response: any) => void) => void;
  onUpdateProgress: (callback: (response: any) => void) => void;
  onUpdateCompleted: (callback: (response: any) => void) => void;
  onUpdateError: (callback: (response: any) => void) => void;
  setUrl: (url: string) => Promise<void>;
  checkUpdate: () => void;
  cancelUpdate: () => void;
  startDownload: () => void;
  quitAndInstall: () => void;
}

interface Logger {
  warn: (msg: string) => Promise<void>;
  error: (msg: string) => Promise<void>;
  info: (msg: string) => Promise<void>;
  verbose: (msg: string) => Promise<void>;
  debug: (msg: string) => Promise<void>;
  silly: (msg: string) => Promise<void>;
}

declare interface Window {
  electron: {
    queryDB: <T>(
      params: QueryDBType
    ) => Promise<{ code: number; data: any; msg: string }>;
    fs: fsProxy;
    env: "development" | "production";
    update: AppUpdate;
    logger: Logger;
    createWindow: () => Promise<string>;
  };
}
