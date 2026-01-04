import upperFirst from "../../utils/upper-first";
import { db } from "../drizzle";
import { permissionAction, rolePermission, userRole } from "../schema";

type UserRole = typeof userRole.$inferInsert;
type PermissionAction = typeof permissionAction.$inferInsert;

const userPermissions = [
  "create",
  "list",
  "promote",
  "ban",
  "impersonate",
  "delete",
  "edit",
] as const;

const sessionPermissions = ["list", "revoke", "delete"] as const;

const pagePermissions = [
  "publish",
  "edit",
  "edit_others",
  "edit_published",
  "delete",
  "delete_others",
  "delete_published",
  "delete_private",
  "edit_private",
  "read_private",
] as const;

const mediaPermissions = [
  "edit_files",
  "upload_files",
  "delete_files",
  "import",
  "export",
] as const;

const postPermissions = [
  "moderate_comments",
  "manage_categories",
  "manage_links",
  "edit_comment",
  "edit",
  "edit_others",
  "edit_published",
  "publish",
  "read",
  "delete",
  "delete_others",
  "delete_published",
  "delete_private",
  "edit_private",
  "read_private",
] as const;

const systemPermissions = [
  "manage_options",
  "switch_themes",
  "edit_dashboard",
  "edit_themes",
  "edit_theme_options",
  "install_themes",
  "activate_plugins",
  "edit_plugins",
  "install_plugins",
  "customize",
  "delete_site",
  "update_plugins",
  "delete_plugins",
  "update_themes",
  "update_core",
  "delete_themes",
  "create_sites",
  "delete_sites",
  "manage_network",
  "manage_sites",
  "manage_network_users",
  "manage_network_themes",
  "manage_network_options",
  "manage_network_plugins",
  "upload_plugins",
  "upload_themes",
  "upgrade_network",
  "setup_network",
  "unfiltered_upload",
  "unfiltered_html",
] as const;

const statement = {
  media: [...mediaPermissions],
  page: [...pagePermissions],
  post: [...postPermissions],
  session: [...sessionPermissions],
  system: [...systemPermissions],
  user: [...userPermissions],
};

const SEED_ROLES: Array<UserRole> = [
  {
    name: "superadmin",
    description: "Super Admin",
  },
  {
    name: "admin",
    description:
      "Administrator: The highest level of permission. Admins have the power to access almost everything.",
  },
  {
    name: "editor",
    description:
      "Editor: Has access to all posts, pages, comments, categories, and tags, and can upload media.",
  },
  {
    name: "author",
    description:
      "Author: Can write, upload media, edit, and publish their own posts.",
  },
  {
    name: "contributor",
    description:
      "Contributor: Has no publishing or uploading capability but can write and edit their own posts until they are published.",
  },
  {
    name: "subscriber",
    description: "Subscriber: People who subscribe to your site’s updates.",
  },
];

const SEED_ACTIONS: Array<PermissionAction> = Object.entries(statement).reduce(
  (accumulator: Array<PermissionAction>, [key, permissions]) => {
    const newPermissions = permissions.map((action) => ({
      action: `${key.toLowerCase()}:${action.toLowerCase()}`,
      group: key.toLowerCase(),
      description: `${upperFirst(key)}: ${action
        .split(".")
        .map(upperFirst)
        .join(" ")}`,
    }));
    return accumulator.concat(newPermissions);
  },
  []
);

function filterPermission(
  permission: PermissionAction,
  filterGroup: keyof typeof statement,
  filterActions: string[]
) {
  return filterActions.length
    ? !(
        permission.group === filterGroup &&
        filterActions.some((action) => action === permission.action)
      )
    : true;
}

function filterPermissionGroup(
  permission: PermissionAction,
  filterGroup: keyof typeof statement
) {
  return permission.group !== filterGroup;
}

function filterAdminPermissions(permission: PermissionAction) {
  const filterSystemActions = [
    "create_sites",
    "delete_sites",
    "manage_network",
    "manage_sites",
    "manage_network_users",
    "manage_network_plugins",
    "manage_network_themes",
    "manage_network_options",
    "upload_plugins",
    "upload_themes",
    "upload_network",
    "upgrade_network",
    "setup_network",
  ];
  return filterPermission(permission, "system", filterSystemActions);
}

function filterEditorPermissions(permission: PermissionAction) {
  const filterSystemActions: Array<(typeof systemPermissions)[number]> = [
    "activate_plugins",
    "delete_plugins",
    "delete_themes",
    "edit_plugins",
    "edit_theme_options",
    "edit_themes",
    "install_plugins",
    "install_themes",
    "manage_options",
    "switch_themes",
    "update_core",
    "update_plugins",
    "update_themes",
    "edit_dashboard",
    "customize",
    "delete_site",
  ];

  const filterMediaActions: Array<(typeof mediaPermissions)[number]> = [
    "edit_files",
    "export",
    "import",
  ];

  return (
    filterPermissionGroup(permission, "user") ||
    filterPermission(permission, "system", filterSystemActions) ||
    filterPermission(permission, "media", filterMediaActions) ||
    filterAdminPermissions(permission)
  );
}

function filterAuthorPermissions(permission: PermissionAction) {
  const filterSystemActions: Array<(typeof systemPermissions)[number]> = [
    "unfiltered_html",
    "unfiltered_upload",
  ];
  const filterPostActions: Array<(typeof postPermissions)[number]> = [
    "moderate_comments",
    "manage_categories",
    "manage_links",
    "edit_others",
    "delete_others",
    "delete_private",
    "edit_private",
    "read_private",
  ];
  const filterPageActions: Array<(typeof pagePermissions)[number]> = [
    "edit",
    "edit_others",
    "edit_published",
    "publish",
    "delete",
    "delete_others",
    "delete_published",
    "delete_private",
    "edit_private",
    "read_private",
  ];
  return (
    filterPermission(permission, "system", filterSystemActions) ||
    filterPermission(permission, "post", filterPostActions) ||
    filterPermission(permission, "page", filterPageActions) ||
    filterEditorPermissions(permission)
  );
}

function filterContributorPermissions(permission: PermissionAction) {
  const filterPostActions: Array<(typeof postPermissions)[number]> = [
    "edit_published",
    "publish",
    "delete_published",
  ];
  const filterMediaActions: Array<(typeof mediaPermissions)[number]> = [
    "upload_files",
  ];
  return (
    filterPermission(permission, "post", filterPostActions) ||
    filterPermission(permission, "media", filterMediaActions) ||
    filterAuthorPermissions(permission)
  );
}

function filterSubscriberPermissions(permission: PermissionAction) {
  const filterPostActions: Array<(typeof postPermissions)[number]> = [
    "edit",
    "delete",
  ];
  return (
    filterPermission(permission, "post", filterPostActions) ||
    filterContributorPermissions(permission)
  );
}

async function createUserRoles() {
  for await (const seed of SEED_ROLES) {
    await db
      .insert(userRole)
      .values(seed)
      .onConflictDoUpdate({
        target: userRole.name,
        set: { ...seed },
      });
  }
}

async function createPermissionActions() {
  for await (const seed of SEED_ACTIONS) {
    await db
      .insert(permissionAction)
      .values(seed)
      .onConflictDoUpdate({
        target: permissionAction.action,
        set: { ...seed },
      });
  }
}

async function createRolePermissions() {
  const permissions = SEED_ACTIONS;

  for await (const role of SEED_ROLES) {
    switch (role.name) {
      case "superadmin":
        for await (const permission of permissions) {
          await db
            .insert(rolePermission)
            .values({
              role: role.name,
              action: permission.action,
            })
            .onConflictDoNothing();
        }
        break;
      case "admin":
        const adminPermissions = permissions.filter(filterAdminPermissions);
        for await (const permission of adminPermissions) {
          await db
            .insert(rolePermission)
            .values({
              role: role.name,
              action: permission.action,
            })
            .onConflictDoNothing();
        }
        break;
      case "editor":
        const editorPermissions = permissions.filter(filterEditorPermissions);
        for await (const permission of editorPermissions) {
          await db
            .insert(rolePermission)
            .values({
              role: role.name,
              action: permission.action,
            })
            .onConflictDoNothing();
        }
        break;
      case "author":
        const authorPermissions = permissions.filter(filterAuthorPermissions);
        for await (const permission of authorPermissions) {
          await db
            .insert(rolePermission)
            .values({
              role: role.name,
              action: permission.action,
            })
            .onConflictDoNothing();
        }
        break;
      case "contributor":
        const contributorPermissions = permissions.filter(
          filterContributorPermissions
        );
        for await (const permission of contributorPermissions) {
          await db
            .insert(rolePermission)
            .values({
              role: role.name,
              action: permission.action,
            })
            .onConflictDoNothing();
        }
        break;
      default:
        const subscriberPermissions = permissions.filter(
          filterSubscriberPermissions
        );
        for await (const permission of subscriberPermissions) {
          await db
            .insert(rolePermission)
            .values({
              role: role.name,
              action: permission.action,
            })
            .onConflictDoNothing();
        }
        break;
    }
  }
}

export async function seedPermissions() {
  console.log("Seeding user permission records...");
  await createUserRoles();
  await createPermissionActions();
  await createRolePermissions();
}
