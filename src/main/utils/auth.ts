import dotenv from "dotenv";
import { session } from "electron";
import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { db } from "../db/drizzle";

dotenv.config();
const ACCESS_TOKEN_SECRET = new TextEncoder().encode(
  process.env.ACCESS_TOKEN_SECRET || "your-32-char-access-token-secret-here"
);
const REFRESH_TOKEN_SECRET = new TextEncoder().encode(
  process.env.REFRESH_TOKEN_SECRET || "your-32-char-refresh-token-secret-here"
);

export const generateAccessToken = async (payload: JWTPayload) => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("urn:example:issuer")
    .setAudience("urn:example:audience")
    .setExpirationTime("15m") // Short lifespan
    .sign(ACCESS_TOKEN_SECRET);
};

export const generateRefreshToken = async (payload: JWTPayload) => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("urn:example:issuer")
    .setAudience("urn:example:audience")
    .setExpirationTime("30d") // Long lifespan
    .sign(REFRESH_TOKEN_SECRET);
};

export const verifyToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, ACCESS_TOKEN_SECRET, {
      issuer: "urn:example:issuer",
      audience: "urn:example:audience",
    });
    return payload;
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

export const getCurrentUser = async () => {
  try {
    const cookieStore = session.defaultSession.cookies;
    const cookies = await cookieStore.get({ name: "access_token" });
    if (cookies.length === 0) {
      return null;
    }
    const accessToken = cookies[0].value;
    const userSession = await verifyToken(accessToken);
    const currentUser = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.id, userSession.userId as string),
    });
    if (!currentUser) {
      return null;
    }
    const { password, ...user } = currentUser;
    return user;
  } catch (error) {
    console.error("Error retrieving current user:", error);
    return null;
  }
};

export const checkUserPermission = async (
  user: { id: string; role: string },
  requiredRole: string
) => {
  // Simple role hierarchy for demonstration
  const roleHierarchy: Record<string, number> = {
    user: 1,
    moderator: 2,
    admin: 3,
  };
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
};

export const setAuthCookies = async (
  accessToken: string,
  refreshToken: string
) => {
  const cookieStore = session.defaultSession.cookies;
  await cookieStore.set({
    url: "http://localhost", // Adjust based on your app's URL
    name: "access_token",
    value: accessToken,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  await cookieStore.set({
    url: "http://localhost", // Adjust based on your app's URL
    name: "refresh_token",
    value: refreshToken,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
};

export const clearAuthCookies = async () => {
  const cookieStore = session.defaultSession.cookies;
  await cookieStore.remove("http://localhost", "access_token");
  await cookieStore.remove("http://localhost", "refresh_token");
};
