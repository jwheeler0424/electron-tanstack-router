import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { idPrimaryKey } from "./common.schema";

export const user = pgTable("user", {
  id: idPrimaryKey,
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role")
    .notNull()
    .default("user")
    .references(() => userRole.name, {
      onDelete: "set default",
    }),
  username: text("username").unique().notNull(),
  displayUsername: text("display_username"),
});

export const account = pgTable("account", {
  id: idPrimaryKey,
  accountId: uuid("account_id")
    .$defaultFn(() => uuidv7())
    .notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// --- ROLES & PERMISSIONS SCHEMAS ---

export const userRole = pgTable("user_role", {
  id: idPrimaryKey,
  name: text("name").notNull().unique(), // Role name must be unique
  description: text("description"),
});

export const rolePermission = pgTable(
  "role_permission",
  {
    role: text("role")
      .notNull()
      .references(() => userRole.name, { onDelete: "cascade" }),
    action: text("action")
      .notNull()
      .references(() => permissionAction.action, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.role, table.action] })]
);

export const permissionAction = pgTable("permission_action", {
  id: idPrimaryKey,
  action: text("action").notNull().unique(),
  description: text("description"),
  group: varchar("group", { length: 256 }).notNull(),
});

// --- DRIZZLE RELATIONS ---

export const userAccountRelations = relations(user, ({ one }) => ({
  account: one(account, {
    fields: [user.id],
    references: [account.userId],
  }),
}));

/**
 * A UserRole can have many Permissions.
 * This defines the relationship from the role's perspective, looking through the join table.
 */
export const userRoleRelations = relations(userRole, ({ many }) => ({
  permissions: many(rolePermission),
}));

/**
 * A PermissionAction can belong to many Roles.
 * This defines the relationship from the action's perspective, looking through the join table.
 */
export const permissionActionRelations = relations(
  permissionAction,
  ({ many }) => ({
    roles: many(rolePermission),
  })
);

/**
 * The join table links one Role to one Action.
 * These relations allow you to include the actual role or action data when querying
 * the join table itself.
 */
export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  userRole: one(userRole, {
    fields: [rolePermission.role],
    references: [userRole.name],
  }),
  permissionAction: one(permissionAction, {
    fields: [rolePermission.action],
    references: [permissionAction.action],
  }),
}));
