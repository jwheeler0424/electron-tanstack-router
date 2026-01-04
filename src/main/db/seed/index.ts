import { seedPermissions } from "./permissions";
import { seedUsers } from "./users";

export async function seedDatabase() {
  await seedPermissions();
  await seedUsers();
}
