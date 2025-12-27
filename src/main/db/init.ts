import { connect } from "./connect";
export const init = async () => {
  // await import('./db/controller/index')
  await connect();
};
