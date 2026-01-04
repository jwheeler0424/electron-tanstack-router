import { eq } from "drizzle-orm";
import { IpcMainInvokeEvent } from "electron";
import { db } from "../../db/drizzle";
import { generateAccessToken, generateRefreshToken } from "../../utils/auth";
import { verifyPassword } from "../../utils/password";
import { response } from "../../utils/response";

export class AuthController {
  constructor() {}

  async login(
    event: IpcMainInvokeEvent,
    payload: { username: string; password: string }
  ) {
    const { username, password } = payload;
    try {
      const requestedUser = await db.query.user.findFirst({
        with: {
          account: true,
        },
        where: (userTable) => eq(userTable.username, username),
      });
      if (!requestedUser) {
        return response.error({
          msg: "User not found",
          code: 404,
        });
      }
      const isPasswordValid = verifyPassword(
        password,
        requestedUser.account?.password ?? ""
      );
      if (!isPasswordValid) {
        return response.error({
          msg: "Invalid password",
          code: 401,
        });
      }
      const { account: _, ...userData } = requestedUser;
      const accessToken = await generateAccessToken({ user: userData });
      const refreshToken = await generateRefreshToken({ user: userData });
      // await setAuthCookies(accessToken, refreshToken);
      return response.ok({ data: { accessToken, refreshToken } });
    } catch (error) {
      console.error(error);
      return response.error({
        msg: "An error occurred during login",
        code: 500,
      });
    }
  }

  async logout(event: IpcMainInvokeEvent) {
    // await this.authService.logout();
    return response.ok();
  }

  async register(
    event: IpcMainInvokeEvent,
    username: string,
    email: string,
    password: string
  ) {
    // await this.authService.register(username, email, password);
    return response.ok();
  }

  async resetPassword(event: IpcMainInvokeEvent, email: string) {
    // await this.authService.resetPassword(email);
    return response.ok();
  }

  async changePassword(
    event: IpcMainInvokeEvent,
    oldPassword: string,
    newPassword: string
  ) {
    // await this.authService.changePassword(oldPassword, newPassword);
    return response.ok();
  }

  async getToken(event: IpcMainInvokeEvent, refreshToken: string) {
    // const data = await this.authService.getToken(refreshToken);
    return response.ok({ data: null });
  }

  async me(event: IpcMainInvokeEvent) {
    // const data = await this.authService.me();
    return response.ok({ data: null });
  }
}
