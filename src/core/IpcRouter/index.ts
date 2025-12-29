import { response } from "@/main/utils/response";
import { BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { RouteParser } from "./parser";

export class IpcRouter {
  // O(1) Lookup for static paths (e.g., "GET:settings:all")
  private staticRoutes = new Map<string, any>();
  // O(n) Lookup for dynamic paths (e.g., "GET:users:[id]")
  private dynamicRoutes: Array<{
    method: string;
    pattern: string;
    handler: any;
  }> = [];

  private prefix: string;

  constructor(prefix: string = "") {
    this.prefix = prefix;
    // Only the root router (usually the one in main.ts) sets up the listener
    if (!this.prefix) {
      this.setupDispatcher();
    }
  }

  private setupDispatcher() {
    ipcMain.handle("api-dispatcher", async (event, { fullChannel, body }) => {
      const start = Date.now();

      // 1. Try Static Match First (High Performance)
      const staticHandler = this.staticRoutes.get(fullChannel);
      if (staticHandler) {
        return this.execute(staticHandler, event, fullChannel, {}, body, start);
      }

      // 2. Try Dynamic Match Second
      for (const route of this.dynamicRoutes) {
        const params = RouteParser.parse(
          route.method,
          route.pattern,
          fullChannel
        );
        if (params) {
          return this.execute(
            route.handler,
            event,
            fullChannel,
            params,
            body,
            start
          );
        }
      }

      return response.notFound({ msg: `Route ${fullChannel} not found` });
    });
  }

  /**
   * Mounts a sub-router under a specific prefix
   */
  public mount(path: string, subRouter: IpcRouter) {
    const cleanPath = path.replace(/:+$/, ""); // Remove trailing colons

    // Merge static routes with new prefix
    subRouter.staticRoutes.forEach((handler, channel) => {
      const [method, ...rest] = channel.split(":");
      const newChannel = `${method}:${cleanPath}:${rest.join(":")}`;
      this.staticRoutes.set(newChannel, handler);
    });

    // Merge dynamic routes with new prefix
    subRouter.dynamicRoutes.forEach((route) => {
      this.dynamicRoutes.push({
        method: route.method,
        pattern: `${cleanPath}:${route.pattern}`,
        handler: route.handler,
      });
    });
  }

  // --- Registration Methods ---

  public get(path: string, h: any) {
    this.register("GET", path, h);
  }
  public post(path: string, h: any) {
    this.register("POST", path, h);
  }
  public put(path: string, h: any) {
    this.register("PUT", path, h);
  }
  public patch(path: string, h: any) {
    this.register("PATCH", path, h);
  }
  public delete(path: string, h: any) {
    this.register("DELETE", path, h);
  }

  private register(method: string, path: string, handler: any) {
    const isDynamic = path.includes("[") && path.includes("]");

    if (isDynamic) {
      this.dynamicRoutes.push({ method, pattern: path, handler });
    } else {
      // Key: "GET:users:list"
      this.staticRoutes.set(`${method}:${path}`, handler);
    }
  }

  // --- Execution Core ---

  private async execute(
    handler: any,
    event: IpcMainInvokeEvent,
    channel: string,
    params: any,
    body: any,
    start: number
  ) {
    return new Promise((resolve) => {
      const res = {
        ...response,
        send: (p: any) => {
          this.log(p.code, channel, Date.now() - start);
          resolve(p);
        },
        emit: (c: string, d: any) =>
          !event.sender.isDestroyed() && event.sender.send(c, d),
        broadcast: (c: string, d: any) =>
          BrowserWindow.getAllWindows().forEach((w) =>
            w.webContents.send(c, d)
          ),
      };

      try {
        const req = { event, body, params, channel };
        Promise.resolve(handler(req, res)).catch((err) => {
          console.error(err);
          resolve(response.error({ error: err.message || err }));
        });
      } catch (err) {
        resolve(response.error({ error: err }));
      }
    });
  }

  private log(code: number, channel: string, time: number) {
    const color = code >= 400 ? "\x1b[31m" : "\x1b[32m";
    console.log(`[IPC] ${color}${code}\x1b[0m | ${channel} | ${time}ms`);
  }
}
