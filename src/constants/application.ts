import pkg from "../../package.json";

export const APP_NAME = pkg.name;

export const DB_NAME =
  process.env.NODE_ENV === "development" ? `${APP_NAME}-dev` : APP_NAME;

export const UPDATE_CHANNEL = {
  INIT: "update:init",
  SET_URL: "update:url",
  CANCEL_UPDATE: "update:cancel",
  CHECK_UPDATE: "update:check",
  START_DOWNLOAD: "update:start",
  QUIT_AND_INSTALL: "update:install",
  ERROR: "update:error",
  PROGRESS: "update:progress",
  COMPLETED: "update:completed",
  MSG: "update:message",
};

export enum UPDATE_CODE {
  error = -1,
  checking = 0,
  updateAvaible = 1,
  updateNotAvaible = 2,
  downloadProgress = 3,
  updateDownloaded = 4,
  updateCancelled = 5,
}

export const AUTH_CHANNEL = {
  LOGIN: "auth:login",
  LOGOUT: "auth:logout",
  ME: "auth:me",
  REGISTER: "auth:register",
  TOKEN: "auth:token",
  RESET_PASSWORD: "auth:resetPassword",
  CHANGE_PASSWORD: "auth:changePassword",
};

export const USER_CHANNEL = {
  GET: "user:getProfile",
  UPDATE: "user:updateProfile",
  ALL: "user:all",
  CREATE: "user:create",
  DELETE: "user:delete",
};
