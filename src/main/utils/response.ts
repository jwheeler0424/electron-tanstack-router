type ResponseMessage = <TData extends any = null>(opts?: {
  code?: number;
  msg?: string;
  data?: TData;
}) => {
  code: number;
  msg: string;
  data?: TData;
};
type ResponseError = (opts?: {
  code?: number;
  msg?: string;
  error?: Error;
}) => {
  code: number;
  msg: string;
  error?: Error;
};
type ResponseErrorWithData = <TData extends any = null>(opts?: {
  code?: number;
  msg?: string;
  error?: Error;
  data?: TData;
}) => {
  code: number;
  msg: string;
  error?: Error;
  data?: TData;
};
type ApiResponse = ResponseMessage | ResponseError | ResponseErrorWithData;

export const response = {
  ok: <TData>(opts?: { code?: number; msg?: string; data?: TData }) => {
    return {
      code: opts?.code || 200,
      msg: opts?.msg || "OK",
      data: opts?.data || null,
    };
  },
  created: <TData>(opts?: { code?: number; msg?: string; data?: TData }) => {
    return {
      code: opts?.code || 201,
      msg: opts?.msg || "Created",
      data: opts?.data || null,
    };
  },
  noContent: <TData>(opts?: { code?: number; msg?: string; data?: TData }) => {
    return {
      code: opts?.code || 204,
      msg: opts?.msg || "No Content",
      data: opts?.data || null,
    };
  },
  badRequest: (opts?: { code?: number; msg?: string; error?: any }) => {
    return {
      code: opts?.code || 400,
      msg: opts?.msg || "Bad Request",
      error: opts?.error || null,
    };
  },
  unauthorized: (opts?: { code?: number; msg?: string; error?: any }) => {
    return {
      code: opts?.code || 401,
      msg: opts?.msg || "Unauthorized",
      error: opts?.error || null,
    };
  },
  forbidden: (opts?: { code?: number; msg?: string; error?: any }) => {
    return {
      code: opts?.code || 403,
      msg: opts?.msg || "Forbidden",
      error: opts?.error || null,
    };
  },
  notFound: (opts?: { code?: number; msg?: string; error?: any }) => {
    return {
      code: opts?.code || 404,
      msg: opts?.msg || "Not Found",
      error: opts?.error || null,
    };
  },
  error: <TData>(opts?: {
    code?: number;
    msg?: string;
    error?: any;
    data?: TData;
  }) => {
    return {
      code: opts?.code || 500,
      msg: opts?.msg || "Internal Server Error",
      error: opts?.error || null,
      data: opts?.data,
    };
  },
} satisfies {
  ok: ApiResponse;
  created: ApiResponse;
  noContent: ApiResponse;
  badRequest: ApiResponse;
  unauthorized: ApiResponse;
  forbidden: ApiResponse;
  notFound: ApiResponse;
  error: ApiResponse;
};
