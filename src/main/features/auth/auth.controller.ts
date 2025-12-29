import { IpcMainInvokeEvent } from "electron";

export class AuthController {
  async login(
    event: IpcMainInvokeEvent,
    username: string,
    password: string
  ): Promise<boolean> {
    // Implement login logic here
    if (username === "admin" && password === "password") {
      return true;
    }
    return false;
  }
}
