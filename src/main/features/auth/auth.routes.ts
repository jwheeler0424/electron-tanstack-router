import { ipcMain } from "electron";
import { AUTH_CHANNEL } from "../../../constants/application";
import { AuthController } from "./auth.controller";

export async function useAuth(window?: Electron.BrowserWindow | null) {
  const authController = new AuthController();
  // Login route
  ipcMain.handle(AUTH_CHANNEL.LOGIN, authController.login);

  // Logout route
  ipcMain.handle(AUTH_CHANNEL.LOGOUT, authController.logout);

  // Me route
  ipcMain.handle(AUTH_CHANNEL.ME, authController.me);

  // Register route
  ipcMain.handle(AUTH_CHANNEL.REGISTER, authController.register);

  // Reset Password route
  ipcMain.handle(AUTH_CHANNEL.RESET_PASSWORD, authController.resetPassword);

  // Change Password route
  ipcMain.handle(AUTH_CHANNEL.CHANGE_PASSWORD, authController.changePassword);

  // Token route
  ipcMain.handle(AUTH_CHANNEL.TOKEN, authController.getToken);
}
