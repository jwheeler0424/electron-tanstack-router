import { connect } from "./connect";
import { seedDatabase } from "./seed";
export const init = async () => {
  // await import('./db/controller/index')
  await connect();

  console.log("Seeding database...");
  await seedDatabase();
};
