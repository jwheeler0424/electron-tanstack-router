import { ipcRenderer } from "electron";
import { AUTH_CHANNEL } from "../../constants/application";

export const auth = {
  login: (username: string, password: string) =>
    ipcRenderer.invoke(AUTH_CHANNEL.LOGIN, { username, password }),
  logout: () => ipcRenderer.invoke(AUTH_CHANNEL.LOGOUT),
  me: () => ipcRenderer.invoke(AUTH_CHANNEL.ME),
  register: (username: string, email: string, password: string) =>
    ipcRenderer.invoke(AUTH_CHANNEL.REGISTER, { username, email, password }),
  token: (refreshToken: string) =>
    ipcRenderer.invoke(AUTH_CHANNEL.TOKEN, refreshToken),
  resetPassword: (email: string) =>
    ipcRenderer.invoke(AUTH_CHANNEL.RESET_PASSWORD, email),
  changePassword: (oldPassword: string, newPassword: string) =>
    ipcRenderer.invoke(AUTH_CHANNEL.CHANGE_PASSWORD, {
      oldPassword,
      newPassword,
    }),
};
