import { response } from "@/main/utils/response";
import { IpcMainInvokeEvent } from "electron";

// The "Request" object
export interface IpcRequest<TBody = any> {
  event: IpcMainInvokeEvent;
  body: TBody; // The first argument sent from renderer
  params: any[]; // All other arguments
}

// The "Response" object enriched with your helpers
export type IpcResponse = typeof response & {
  send: (payload: any) => void;
  emit: (channel: string, data?: any) => void;
  broadcast: (channel: string, data?: any) => void;
};

// The Handler Signature
export type IpcRouteHandler<T = any> = (
  req: IpcRequest<T>,
  res: IpcResponse
) => void | Promise<void>;
