import { ipcRenderer } from "electron";

export const logger = {
  error: (msg: any) => sendLog("error", msg),
  warn: (msg: any) => sendLog("warn", msg),
  info: (msg: any) => sendLog("info", msg),
  verbose: (msg: any) => sendLog("verbose", msg),
  debug: (msg: any) => sendLog("debug", msg),
  silly: (msg: any) => sendLog("silly", msg),
};

const sendLog = async (level: string, msg: any) =>
  ipcRenderer.send("__ELECTRON_LOG__", {
    // LogMessage-like object
    data: [msg],
    level: level,
    variables: { processType: "renderer" },
    // ... some other optional fields like scope, logId and so on
  });
