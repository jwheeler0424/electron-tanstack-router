import { ipcMain } from "electron";
import { AUTH_CHANNEL } from "../../../constants/application";
import { AuthController } from "./auth.controller";

export async function authRoutes() {
  // Login route
  ipcMain.handle(AUTH_CHANNEL.LOGIN, AuthController.login);

  // Logout route
  ipcMain.handle(AUTH_CHANNEL.LOGOUT, AuthController.logout);

  // Me route
  ipcMain.handle(AUTH_CHANNEL.ME, AuthController.me);

  // Register route
  ipcMain.handle(AUTH_CHANNEL.REGISTER, AuthController.register);

  // Reset Password route
  ipcMain.handle(AUTH_CHANNEL.RESET_PASSWORD, AuthController.resetPassword);

  // Change Password route
  ipcMain.handle(AUTH_CHANNEL.CHANGE_PASSWORD, AuthController.changePassword);

  // Token route
  ipcMain.handle(AUTH_CHANNEL.TOKEN, AuthController.getNewToken);
}
