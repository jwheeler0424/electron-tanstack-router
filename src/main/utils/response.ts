export const response = {
  ok: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 200,
      msg: "OK",
      data: null,
      ...data,
    };
  },
  created: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 201,
      msg: "Created",
      data: null,
      ...data,
    };
  },
  noContent: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 204,
      msg: "No Content",
      data: null,
      ...data,
    };
  },
  badRequest: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 400,
      msg: "Bad Request",
      ...data,
    };
  },
  unauthorized: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 401,
      msg: "Unauthorized",
      ...data,
    };
  },
  forbidden: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 403,
      msg: "Forbidden",
      ...data,
    };
  },
  notFound: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 404,
      msg: "Not Found",
      ...data,
    };
  },
  error: (data?: { code?: number; msg?: string; data?: any }) => {
    return {
      code: 500,
      msg: "Internal Server Error",
      ...data,
    };
  },
};
