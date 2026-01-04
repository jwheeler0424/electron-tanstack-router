export interface IpcPayload {
  fullChannel: string;
  body?: any;
}

export interface ElectronAPI {
  /**
   * Triggers the central API dispatcher in the Main process.
   */
  invoke: (channel: "api-dispatcher", payload: IpcPayload) => Promise<any>;

  /**
   * Sets up a listener for background events (emit/broadcast).
   * Returns a cleanup function to remove the listener.
   */
  on: (channel: string, callback: (data: any) => void) => () => void;
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

interface auth {
  login: (username: string, password: string) => Promise<any>;
  logout: () => Promise<any>;
  me: () => Promise<any>;
  register: (username: string, email: string, password: string) => Promise<any>;
  token: (refreshToken: string) => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<any>;
}

declare global {
  interface Window {
    electron: {
      health: () => Promise<{ status: string }>;
      fs: fsProxy;
      env: "development" | "production";
      update: AppUpdate;
      logger: Logger;
      createWindow: () => Promise<string>;
      auth: auth;
    };
  }
}

export {};
