import { APP_NAME } from "@/constants/application";
import { app } from "electron";
import log from "electron-log";
import path from "path";
import { appConfig as config } from "../config/app.config";

/**
 * error,
 * warn,
 * info,
 * verbose,
 * debug,
 * silly
 */

log.transports.file.resolvePathFn = () =>
  path.join(app.getPath("appData"), APP_NAME, "log", "main.log");

const date = new Date();
const dateStr =
  date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

log.transports.file.fileName = dateStr + ".log";
log.transports.file.format =
  "[{y}-{m}-{d} {h}:{i}:{s}.{ms}][{processType}][{level}]{scope} {text}";
log.transports.file.maxSize = 10 * 1024 * 1024;

if (config.NODE_ENV === "production") {
  log.transports.console.level = false;
}
export default log;
