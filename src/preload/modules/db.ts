import { ipcRenderer } from "electron";

export interface QueryDBType {
  path: string;
  params?: Record<string, any>;
  timeout?: number;
}
/**
 * @param query path string
 * @param query params any
 * @returns
 */
export const queryDB = async (query: QueryDBType) => {
  const config = {
    ...query,
  };
  const path = config.path;
  const renderRquest = ipcRenderer.invoke(config.path, config.params);

  let timer: any = null;
  const timeoutHand = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve({ code: 500, msg: "服务连接超时" });
    }, config.timeout);
  });

  const requestResult = Promise.race([renderRquest, timeoutHand]);
  try {
    const res = await requestResult;
    return res;
  } catch (error) {
    console.warn(
      `render channel ${path} timeout, arg:${JSON.stringify(
        config.params
      )}, error :${error}`
    );
  } finally {
    clearTimeout(timer);
  }
};
