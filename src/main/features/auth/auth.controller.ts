import { IpcMainInvokeEvent } from "electron";
import { response } from "../../utils/response";
import { AuthService } from "./auth.service";

export const AuthController = {
  async login(
    _: IpcMainInvokeEvent,
    payload: { username: string; password: string }
  ) {
    const result = await AuthService.login(payload);
    return result;
  },

  async logout(_: IpcMainInvokeEvent) {
    const result = await AuthService.logout();
    return result;
  },

  async register(
    _: IpcMainInvokeEvent,
    username: string,
    email: string,
    password: string
  ) {
    // await this.authService.register(username, email, password);
    return response.ok();
  },

  async resetPassword(_: IpcMainInvokeEvent, email: string) {
    // await this.authService.resetPassword(email);
    return response.ok();
  },

  async changePassword(
    _: IpcMainInvokeEvent,
    token: string,
    payload: {
      oldPassword: string;
      newPassword: string;
    }
  ) {
    // await this.authService.changePassword(oldPassword, newPassword);
    return response.ok();
  },

  async getNewToken(_: IpcMainInvokeEvent, token: string) {
    // const data = await this.authService.getToken(refreshToken);
    return response.ok({ data: null });
  },

  async me(_: IpcMainInvokeEvent, token: string) {
    const result = await AuthService.me(token);
    return result;
  },
};
