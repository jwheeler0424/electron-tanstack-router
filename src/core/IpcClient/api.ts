import { RouteParser } from "../IpcRouter/parser";

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
  error?: any;
}

class IpcClient {
  public async get<T = any>(path: string, params: Record<string, any> = {}) {
    return this.request<T>("GET", path, null, params);
  }

  public async post<T = any>(
    path: string,
    body?: any,
    params: Record<string, any> = {}
  ) {
    return this.request<T>("POST", path, body, params);
  }

  public async put<T = any>(
    path: string,
    body?: any,
    params: Record<string, any> = {}
  ) {
    return this.request<T>("PUT", path, body, params);
  }

  public async patch<T = any>(
    path: string,
    body?: any,
    params: Record<string, any> = {}
  ) {
    return this.request<T>("PATCH", path, body, params);
  }

  public async delete<T = any>(path: string, params: Record<string, any> = {}) {
    return this.request<T>("DELETE", path, null, params);
  }

  private async request<T>(
    method: string,
    path: string,
    body: any,
    params: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const fullChannel = RouteParser.build(method, path, params);
    // Communicates with the 'api-dispatcher' in Main
    return await window.electron.api.invoke("api-dispatcher", {
      fullChannel,
      body,
    });
  }
}

export const api = new IpcClient();
