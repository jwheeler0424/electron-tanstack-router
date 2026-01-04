import { eq } from "drizzle-orm";
import { hashPassword } from "../../utils/password";
import { db } from "../drizzle";
import { account, user } from "../schema";

type User = typeof user.$inferInsert;
type Account = Partial<typeof account.$inferInsert>;

const SEED_USERS: Array<{ user: User; account: Account }> = [
  {
    user: {
      name: "Jonathan Wheeler",
      email: "jonathan@designersimage.io",
      emailVerified: true,
      image: "https://avatars.githubusercontent.com/u/69223771?s=400&v=4",
      username: "jwheeler",
      displayUsername: "jwheeler",
      role: "superadmin",
    },
    account: { password: "Password123!", providerId: "credential" },
  },
  {
    user: {
      name: "Test User",
      email: "testuser@example.com",
      emailVerified: true,
      image: "",
      username: "testuser",
      displayUsername: "testuser",
      role: "admin",
    },
    account: { password: "Password123!", providerId: "credential" },
  },
];

async function createUsers() {
  try {
    for await (const seed of SEED_USERS) {
      const existingUser = await db.query.user.findFirst({
        where: (userTable) => eq(userTable.username, seed.user.username),
      });
      if (existingUser) {
        continue;
      }
      const hashedPassword = hashPassword(
        seed.account.password ?? "Password123!"
      );
      const [result] = await db
        .insert(user)
        .values(seed.user)
        .onConflictDoNothing()
        .returning();

      const { id: userId } = result;
      const existingAccount = await db.query.account.findFirst({
        where: (account, { eq }) => eq(account.userId, userId),
      });
      if (existingAccount) {
        console.log(
          `Account for user ${seed.user.username} already exists. Skipping...`
        );
        continue;
      }
      await db
        .insert(account)
        .values({
          providerId: seed.account.providerId ?? "credential",
          userId,
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  } catch (error) {
    console.error("Error seeding users:", error);
  }
}

export async function seedUsers() {
  console.log("Seeding user records...");
  await createUsers();
}
