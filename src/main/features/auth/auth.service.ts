import { eq } from "drizzle-orm";
import { db } from "../../db/drizzle";
import { User } from "../../db/schema";
import {
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  setAuthCookies,
  verifyToken,
} from "../../utils/auth";
import { verifyPassword } from "../../utils/password";
import { response } from "../../utils/response";

export const AuthService = {
  async login(payload: { username: string; password: string }) {
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
      await setAuthCookies(accessToken, refreshToken);
      return response.ok({ data: { accessToken, refreshToken } });
    } catch (error) {
      console.error(error);
      return response.error({
        msg: "An error occurred during login",
        code: 500,
      });
    }
  },

  async logout() {
    try {
      // Clear authentication cookies
      await clearAuthCookies();
      return response.ok({
        msg: "Successfully logged out",
      });
    } catch (error) {
      console.error(error);
      return response.error({
        msg: "An error occurred during logout",
        code: 500,
      });
    }
  },

  async register() {},

  async resetPassword() {},

  async changePassword() {},

  async getToken() {},

  async me(token: string) {
    try {
      // Verify token and extract user info
      const payload = await verifyToken<User>(token);
      if (!payload) {
        return response.error({
          msg: "Unauthorized",
          code: 401,
        });
      }
      return response.ok({ data: payload });
    } catch (error) {
      return response.error({
        msg: "An error occurred",
        code: 500,
      });
    }
  },
};
