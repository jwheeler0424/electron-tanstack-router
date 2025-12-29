import { ipcRenderer } from "electron";

export const api = {
  /**
   * @param channel The actual channel string (e.g., "users:get:123")
   * @param body The payload
   */
  invoke: async (channel: string, body?: any) => {
    // We send everything through the 'api-dispatcher'
    return await ipcRenderer.invoke("api-dispatcher", { channel, body });
  },

  on: (channel: string, cb: any) => {
    const sub = (_: any, data: any) => cb(data);
    ipcRenderer.on(channel, sub);
    return () => ipcRenderer.removeListener(channel, sub);
  },
};
