/* router.runtime.ts
   Runtime-first router with mounts, middleware, meta, and RBAC
   NO compile-time route inference
*/

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteMeta = {
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;
};

export type RequestContext = {
  method: HTTPMethod;
  path: string;
  params: Record<string, any>;
  query: Record<string, string>;
  body?: any;
  meta?: RouteMeta;
  raw: { url: string; headers?: Record<string, string | string[]> };
  user?: {
    id?: string;
    roles?: string[];
    permissions?: string[];
  };
};

export type Handler = (ctx: RequestContext) => any | Promise<any>;
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<any>
) => Promise<any>;
export type Guard = (ctx: RequestContext) => boolean | Promise<boolean>;

type RouteEntry = {
  method: HTTPMethod;
  template: string;
  matcher: RegExp;
  paramNames: string[];
  handler: Handler;
  middleware: Middleware[];
  guards: Guard[];
  meta?: RouteMeta;
};

export class RouterBuilder {
  private routes: RouteEntry[] = [];
  private middleware: Middleware[] = [];

  use(mw: Middleware) {
    this.middleware.push(mw);
    return this;
  }

  route(
    method: HTTPMethod,
    path: string,
    handler: Handler,
    opts?: {
      middleware?: Middleware[];
      guards?: Guard[];
      meta?: RouteMeta;
    }
  ) {
    const { regex, params } = compilePath(path);

    const guards = [...(opts?.guards ?? [])];

    // Auto-RBAC from meta
    if (opts?.meta?.roles) {
      guards.push(requireRoles(opts.meta.roles));
    }
    if (opts?.meta?.permissions) {
      guards.push(requirePermissions(opts.meta.permissions));
    }

    this.routes.push({
      method,
      template: path,
      matcher: regex,
      paramNames: params,
      handler,
      middleware: opts?.middleware ?? [],
      guards,
      meta: opts?.meta,
    });

    return this;
  }

  mount(
    prefix: string,
    child: RouterBuilder,
    opts?: {
      inheritMiddleware?: boolean;
      mergeMeta?: "shallow" | "overwrite";
    }
  ) {
    const baseMiddleware =
      opts?.inheritMiddleware !== false ? this.middleware : [];

    for (const r of child.routes) {
      const fullPath =
        prefix === "/"
          ? r.template
          : `${prefix}${r.template === "/" ? "" : r.template}`;

      const { regex, params } = compilePath(fullPath);

      this.routes.push({
        ...r,
        template: fullPath,
        matcher: regex,
        paramNames: params,
        middleware: [...baseMiddleware, ...r.middleware],
        meta: opts?.mergeMeta === "overwrite" ? r.meta : { ...r.meta },
      });
    }

    return this;
  }

  build() {
    return new RouterRuntime([...this.routes], [...this.middleware]);
  }
}

export class RouterRuntime {
  constructor(
    private routes: RouteEntry[],
    private globalMiddleware: Middleware[]
  ) {}

  async handle(
    method: HTTPMethod,
    url: string,
    opts?: {
      body?: any;
      user?: RequestContext["user"];
    }
  ) {
    const [pathname, qs] = url.split("?");
    const query = parseQuery(qs);

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = route.matcher.exec(pathname);
      if (!match) continue;

      const params: Record<string, any> = {};
      route.paramNames.forEach((p, i) => {
        params[p] = coerce(match[i + 1]);
      });

      const ctx: RequestContext = {
        method,
        path: pathname,
        params,
        query,
        body: opts?.body,
        meta: route.meta,
        raw: { url, headers: {} },
        user: opts?.user,
      };

      for (const g of route.guards) {
        if (!(await g(ctx))) {
          throw new Error("Access denied");
        }
      }

      const pipeline = [...this.globalMiddleware, ...route.middleware];

      let i = -1;
      const next = async (): Promise<any> => {
        i++;
        if (i < pipeline.length) {
          return pipeline[i](ctx, next);
        }
        return route.handler(ctx);
      };

      return next();
    }

    throw new Error(`No route for ${method} ${url}`);
  }

  client() {
    return {
      call: (
        method: HTTPMethod,
        path: string,
        opts?: {
          body?: any;
          user?: RequestContext["user"];
        }
      ) => this.handle(method, path, opts),

      get: (p: string, o?: any) => this.handle("GET", p, o),
      post: (p: string, o?: any) => this.handle("POST", p, o),
      del: (p: string, o?: any) => this.handle("DELETE", p, o),
    };
  }
}

/* ---------------- RBAC ---------------- */

export const requireRoles =
  (roles: string[]): Guard =>
  (ctx) =>
    roles.every((r) => ctx.user?.roles?.includes(r));

export const requirePermissions =
  (perms: string[]): Guard =>
  (ctx) =>
    perms.every((p) => ctx.user?.permissions?.includes(p));

/* ---------------- Utils ---------------- */

function compilePath(path: string) {
  const params: string[] = [];

  let pattern =
    "^" +
    path
      .replace(/\//g, "\\/")
      .replace(/\[\.{3}(\w+)\]/g, (_, p) => {
        params.push(p);
        return "(.*)";
      })
      .replace(/\[(\w+)(?::number)?\]/g, (_, p) => {
        params.push(p);
        return "([^/]+)";
      }) +
    "$";

  return {
    regex: new RegExp(pattern),
    params,
  };
}

function parseQuery(qs?: string) {
  const out: Record<string, string> = {};
  if (!qs) return out;
  for (const p of qs.split("&")) {
    const [k, v] = p.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

function coerce(v: string) {
  if (/^\d+$/.test(v)) return Number(v);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

/* ---------------- Example Test ---------------- */
const usersRouter = new RouterBuilder()
  .route("GET", "/", () => ({ list: true }))
  .route("GET", "/[id:number]", (ctx) => ({ id: ctx.params.id }), {
    meta: { roles: ["user"] },
  });

const adminRouter = new RouterBuilder().route(
  "GET",
  "/stats",
  () => ({ stats: true }),
  {
    meta: { roles: ["admin"] },
  }
);

const appRouter = new RouterBuilder()
  .use(async (ctx, next) => {
    console.log("global", ctx.path);
    return next();
  })
  .route("GET", "/ping", () => ({ ok: true }));

appRouter.mount("/users", usersRouter);
appRouter.mount("/admin", adminRouter);

const app = appRouter.build();
const client = app.client();

await client.get("/users/123", {
  user: { roles: ["user"] },
});

await client.get("/admin/stats", {
  user: { roles: ["admin"] },
});

const builder = new RouterBuilder()
  .use(async (ctx, next) => {
    console.log("global", ctx.path);
    return next();
  })
  .route("GET", "/users/[id:number]", async (ctx) => ({ id: ctx.params.id }), {
    meta: { auth: "user" },
  })
  .route("GET", "/files/*path", async (ctx) => ({ path: ctx.params.path }))
  .route(
    "GET",
    "/reports/[year:number]-[month:number]",
    async (ctx) => ctx.params,
    {
      middleware: [
        async (ctx, next) => {
          console.log("route mw", ctx.meta);
          return next();
        },
      ],
      guards: [
        async (ctx) => {
          return !!ctx.raw.headers?.["x-api-key"];
        },
      ],
      meta: { rateLimit: 100 },
    }
  );

const api = builder.build();
const client2 = api.client();

(async () => {
  // local calls
  console.log(await client2.get("/users/[id:number]", { params: { id: 42 } }));
  console.log(await client2.get("/files/*path", { params: { path: "a/b/c" } }));
})();
