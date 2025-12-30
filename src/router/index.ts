/**
 * Enterprise-grade Event Router with Trie-based routing
 * Supports static, parametric, and wildcard event channels
 * Optimized for high-performance lookups and modularity
 * * Includes EventClient for axios-like client-side interaction
 * * ENHANCEMENTS INCLUDED:
 * 1. Automatic Type Coercion (string -> number, boolean, date)
 * 2. LRU Caching for Route Matching (O(1) lookups for hot paths)
 * 3. Regex Instance Caching (Memory optimization)
 * 4. Iterative Matching Algorithm (Stack-based, no recursion depth limits)
 * 5. Request Tracing (traceId propagation)
 * 6. Schema Validation Support (Generic interface for Zod/Joi)
 * 7. Robust Electron WebContents Cleanup
 */

// ============================================================================
// Internal Utilities (LRU Cache)
// ============================================================================

class SimpleLRU<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max: number = 1000) {
    this.max = max;
    this.cache = new Map();
  }

  public get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item) {
      // Refresh item (delete and re-add to end)
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  public set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      // Evict oldest (first item in Map)
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }

  public clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface EventContext<T = any> {
  channel: string;
  params: Record<string, any>; // Changed from string to any for type coercion
  event: T;
  metadata?: Record<string, any>;
  traceId: string; // Added for observability
}

export type EventHandler<T = any> = (
  ctx: EventContext<T>
) => Promise<void> | void;

export type Middleware<T = any> = (
  ctx: EventContext<T>,
  next: () => Promise<void>
) => Promise<void> | void;

export type Guard<T = any> = (
  ctx: EventContext<T>
) => Promise<boolean> | boolean;

/**
 * Generic interface for schema validation (compatible with Zod, Joi, Yup)
 */
export interface ValidatorSchema<T = any> {
  parse?: (data: unknown) => T;
  validate?: (data: unknown) => { value: T; error?: any };
  safeParse?: (data: unknown) => { success: boolean; data?: T; error?: any };
}

export interface RouteConfig<T = any> {
  handler: EventHandler<T>;
  middleware?: Middleware<T>[];
  guards?: Guard<T>[];
  schema?: ValidatorSchema<T>; // Added schema support
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ControllerValue {
  [key: string]: any;
}

export type Controller<T = any> = EventHandler<T> | ControllerValue;

export type ParamType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "uuid"
  | "email"
  | "slug"
  | "ipv4"
  | "alpha"
  | "alphanumeric";

export interface ParamDefinition {
  name: string;
  type?: ParamType;
  position: [number, number]; // [start, end] indices in segment
}

export interface SegmentPattern {
  raw: string;
  params: ParamDefinition[];
  regex?: RegExp;
}

export interface RouteMatch<T = any> {
  handler: EventHandler<T>;
  params: Record<string, any>;
  middleware: Middleware<T>[];
  guards: Guard<T>[];
  schema?: ValidatorSchema<T>;
}

// ============================================================================
// Trie Node Structure
// ============================================================================

enum NodeType {
  STATIC = "static",
  PARAM = "param",
  WILDCARD = "wildcard",
}

class TrieNode<T = any> {
  type: NodeType = NodeType.STATIC;
  segment: string = "";
  pattern?: SegmentPattern; // For complex parametric segments
  paramName?: string; // For simple single-param segments
  children: Map<string, TrieNode<T>> = new Map();
  paramChild?: TrieNode<T>;
  wildcardChild?: TrieNode<T>;
  handler?: EventHandler<T>;
  controllers: Map<HttpMethod, Controller<T>> = new Map();
  middleware: Middleware<T>[] = [];
  guards: Guard<T>[] = [];
  schema?: ValidatorSchema<T>;
  isEndpoint: boolean = false;

  constructor(segment: string = "", type: NodeType = NodeType.STATIC) {
    this.segment = segment;
    this.type = type;
  }
}

// ============================================================================
// Event Router Implementation
// ============================================================================

export class EventRouter<T = any> {
  private root: TrieNode<T>;
  private globalMiddleware: Middleware<T>[] = [];
  private globalGuards: Guard<T>[] = [];
  private delimiter: string;

  // Optimization: LRU Cache for route matching
  private matchCache: SimpleLRU<string, RouteMatch<T> | null>;

  // Optimization: Regex Pattern Cache
  private static regexCache: Map<string, RegExp> = new Map();

  constructor(delimiter: string = ":") {
    this.root = new TrieNode<T>();
    this.delimiter = delimiter;
    this.matchCache = new SimpleLRU(1000);
  }

  /**
   * Register a route with handler, middleware, and guards
   */
  public on(
    channel: string,
    handler: EventHandler<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    this.matchCache.clear(); // Invalidate cache on new route

    const segments = this.parseChannel(channel);
    let node = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      node = this.insertSegment(node, segment);
    }

    node.isEndpoint = true;
    node.handler = handler;
    node.middleware = config?.middleware || [];
    node.guards = config?.guards || [];
    node.schema = config?.schema;

    return this;
  }

  /**
   * Register multiple routes at once
   */
  public routes(routes: Record<string, RouteConfig<T>>): this {
    for (const [channel, config] of Object.entries(routes)) {
      this.on(channel, config.handler, {
        middleware: config.middleware,
        guards: config.guards,
        schema: config.schema,
      });
    }
    return this;
  }

  /**
   * Register a GET controller
   */
  public get(
    channel: string,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    return this.registerController(channel, "GET", controller, config);
  }

  /**
   * Register a POST controller
   */
  public post(
    channel: string,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    return this.registerController(channel, "POST", controller, config);
  }

  /**
   * Register a PUT controller
   */
  public put(
    channel: string,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    return this.registerController(channel, "PUT", controller, config);
  }

  /**
   * Register a PATCH controller
   */
  public patch(
    channel: string,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    return this.registerController(channel, "PATCH", controller, config);
  }

  /**
   * Register a DELETE controller
   */
  public delete(
    channel: string,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    return this.registerController(channel, "DELETE", controller, config);
  }

  /**
   * Add global middleware (executed for all routes)
   */
  public use(middleware: Middleware<T>): this {
    this.globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Add global guard (executed for all routes)
   */
  public guard(guard: Guard<T>): this {
    this.globalGuards.push(guard);
    return this;
  }

  /**
   * Merge another router into this one with optional prefix
   */
  public merge(router: EventRouter<T>, prefix: string = ""): this {
    this.matchCache.clear(); // Invalidate cache

    const prefixSegments = prefix ? this.parseChannel(prefix) : [];
    this.mergeNode(this.root, router.root, prefixSegments);

    // Merge global middleware and guards
    this.globalMiddleware.push(...router.globalMiddleware);
    this.globalGuards.push(...router.globalGuards);

    return this;
  }

  /**
   * Emit an event through the router
   */
  public async emit(
    channel: string,
    event: T,
    metadata?: Record<string, any>
  ): Promise<void> {
    const match = this.match(channel);

    if (!match) {
      throw new Error(`No handler found for channel: ${channel}`);
    }

    // Schema Validation
    if (match.schema) {
      this.validatePayload(match.schema, event);
    }

    const ctx: EventContext<T> = {
      channel,
      params: match.params,
      event,
      metadata,
      traceId: metadata?.traceId || this.generateUUID(),
    };

    // Execute guards
    const allGuards = [...this.globalGuards, ...match.guards];
    for (const guard of allGuards) {
      const allowed = await guard(ctx);
      if (!allowed) {
        throw new Error(`Guard rejected event for channel: ${channel}`);
      }
    }

    // Execute middleware chain with handler at the end
    const allMiddleware = [...this.globalMiddleware, ...match.middleware];
    await this.executeMiddlewareChain(ctx, allMiddleware, match.handler);
  }

  /**
   * Execute a controller method (GET, POST, PUT, PATCH, DELETE)
   */
  public async execute(
    method: HttpMethod,
    channel: string,
    event: T,
    metadata?: Record<string, any>
  ): Promise<any> {
    // Note: Controllers use a separate lookup than standard emit matching
    const match = this.matchController(channel, method);

    if (!match) {
      throw new Error(`No ${method} controller found for channel: ${channel}`);
    }

    // Schema Validation
    if (match.schema) {
      this.validatePayload(match.schema, event);
    }

    const ctx: EventContext<T> = {
      channel,
      params: match.params,
      event,
      metadata,
      traceId: metadata?.traceId || this.generateUUID(),
    };

    // Execute guards
    const allGuards = [...this.globalGuards, ...match.guards];
    for (const guard of allGuards) {
      const allowed = await guard(ctx);
      if (!allowed) {
        throw new Error(`Guard rejected ${method} for channel: ${channel}`);
      }
    }

    // If controller is a value, return it directly
    if (typeof match.controller !== "function") {
      return match.controller;
    }

    // Execute middleware chain with controller handler at the end
    const allMiddleware = [...this.globalMiddleware, ...match.middleware];
    let result: any;
    const handler: EventHandler<T> = async (ctx) => {
      result = await (match.controller as EventHandler<T>)(ctx);
    };

    await this.executeMiddlewareChain(ctx, allMiddleware, handler);
    return result;
  }

  /**
   * Match a channel and return the handler with params
   * Optimized with LRU Cache
   */
  public match(channel: string): RouteMatch<T> | null {
    // Check Cache First
    const cached = this.matchCache.get(channel);
    if (cached !== undefined) {
      return cached;
    }

    const segments = this.parseChannel(channel);
    const params: Record<string, any> = {};

    // Use optimized iterative matching
    const node = this.matchSegmentsIterative(this.root, segments, params);

    if (!node || !node.isEndpoint || !node.handler) {
      this.matchCache.set(channel, null);
      return null;
    }

    const result: RouteMatch<T> = {
      handler: node.handler,
      params,
      middleware: node.middleware,
      guards: node.guards,
      schema: node.schema,
    };

    this.matchCache.set(channel, result);
    return result;
  }

  /**
   * Check if a route exists
   */
  public has(channel: string): boolean {
    return this.match(channel) !== null;
  }

  /**
   * Get all registered routes (for debugging/introspection)
   */
  public getRoutes(): string[] {
    const routes: string[] = [];
    this.collectRoutes(this.root, [], routes);
    return routes;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private validatePayload(schema: ValidatorSchema<T>, data: any): void {
    if (schema.safeParse) {
      const result = schema.safeParse(data);
      if (!result.success) {
        throw new Error(`Validation Error: ${JSON.stringify(result.error)}`);
      }
    } else if (schema.parse) {
      schema.parse(data);
    } else if (schema.validate) {
      const { error } = schema.validate(data);
      if (error) {
        throw new Error(`Validation Error: ${error.message}`);
      }
    }
  }

  private registerController(
    channel: string,
    method: HttpMethod,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    this.matchCache.clear(); // Invalidate cache
    const segments = this.parseChannel(channel);
    let node = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      node = this.insertSegment(node, segment);
    }

    node.isEndpoint = true;
    node.controllers.set(method, controller);
    node.schema = config?.schema;

    if (config?.middleware) {
      node.middleware = [...node.middleware, ...config.middleware];
    }
    if (config?.guards) {
      node.guards = [...node.guards, ...config.guards];
    }

    return this;
  }

  private matchController(
    channel: string,
    method: HttpMethod
  ): {
    controller: Controller<T>;
    params: Record<string, any>;
    middleware: Middleware<T>[];
    guards: Guard<T>[];
    schema?: ValidatorSchema<T>;
  } | null {
    // Note: We don't cache controller lookups yet as they vary by Method
    const segments = this.parseChannel(channel);
    const params: Record<string, any> = {};

    const node = this.matchSegmentsIterative(this.root, segments, params);

    if (!node || !node.isEndpoint) {
      return null;
    }

    const controller = node.controllers.get(method);
    if (!controller) {
      return null;
    }

    return {
      controller,
      params,
      middleware: node.middleware,
      guards: node.guards,
      schema: node.schema,
    };
  }

  private parseChannel(channel: string): string[] {
    return channel.split(this.delimiter).filter((s) => s.length > 0);
  }

  private parseSegmentPattern(segment: string): SegmentPattern | null {
    // Match all parameter definitions: [name] or [name:type]
    const paramRegex = /\[([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z]+))?\]/g;
    const params: ParamDefinition[] = [];
    let match: RegExpExecArray | null;

    while ((match = paramRegex.exec(segment)) !== null) {
      params.push({
        name: match[1],
        type: match[2] as ParamType | undefined,
        position: [match.index, match.index + match[0].length],
      });
    }

    if (params.length === 0) {
      return null;
    }

    // Optimization: Regex Instance Caching
    // If we've seen this exact segment pattern before, reuse the Regex
    const cacheKey = segment;
    if (EventRouter.regexCache.has(cacheKey)) {
      return {
        raw: segment,
        params,
        regex: EventRouter.regexCache.get(cacheKey),
      };
    }

    let regexPattern = "^";
    let lastIndex = 0;

    for (const param of params) {
      if (param.position[0] > lastIndex) {
        const literal = segment.substring(lastIndex, param.position[0]);
        // Fixed regex escape sequence
        regexPattern += literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      const capturePattern = this.getTypePattern(param.type);
      regexPattern += `(${capturePattern})`;

      lastIndex = param.position[1];
    }

    if (lastIndex < segment.length) {
      const literal = segment.substring(lastIndex);
      regexPattern += literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    regexPattern += "$";
    const compiledRegex = new RegExp(regexPattern);

    EventRouter.regexCache.set(cacheKey, compiledRegex);

    return {
      raw: segment,
      params,
      regex: compiledRegex,
    };
  }

  private getTypePattern(type?: ParamType): string {
    switch (type) {
      case "number":
        // Matches integers and decimals (e.g., 123, -45.67)
        return "-?\\d+(?:\\.\\d+)?";
      case "boolean":
        // Matches true or false
        return "true|false";
      case "datetime":
        // Matches ISO 8601 strings
        return "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?";
      case "uuid":
        // Matches standard UUID v4/v5
        return "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
      case "email":
        // Basic RFC 5322 email validation
        return "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}";
      case "slug":
        // Matches URL-friendly strings (lowercase, numbers, and hyphens)
        return "[a-z0-9]+(?:-[a-z0-9]+)*";
      case "ipv4":
        // Matches 0.0.0.0 through 255.255.255.255
        return "(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
      case "alpha":
        // Matches strictly alphabetic characters
        return "[a-zA-Z]+";
      case "alphanumeric":
        // Matches letters and numbers
        return "[a-zA-Z0-9]+";
      case "string":
      default:
        // Default: everything until the next delimiter (:)
        return "[^:]+";
    }
  }

  // Enhancement: Automatic Type Coercion
  private coerceParamValue(value: string, type?: ParamType): any {
    if (value === undefined || value === null) return value;

    switch (type) {
      case "number":
        const num = Number(value);
        return isNaN(num) ? value : num;

      case "boolean":
        return value.toLowerCase() === "true";

      case "datetime":
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date;

      case "ipv4":
      case "email":
      case "slug":
      case "alpha":
      case "alphanumeric":
      case "uuid":
        // These types are validated by the Regex in getTypePattern,
        // but they remain strings in JavaScript.
        return value;

      case "string":
      default:
        return value;
    }
  }

  private extractParamsFromSegment(
    segment: string,
    pattern: SegmentPattern
  ): Record<string, any> | null {
    if (!pattern.regex) {
      return null;
    }

    const match = pattern.regex.exec(segment);
    if (!match) {
      return null;
    }

    const params: Record<string, any> = {};
    for (let i = 0; i < pattern.params.length; i++) {
      const param = pattern.params[i];
      const strValue = match[i + 1];
      params[param.name] = this.coerceParamValue(strValue, param.type);
    }

    return params;
  }

  private insertSegment(node: TrieNode<T>, segment: string): TrieNode<T> {
    if (segment === "*") {
      if (!node.wildcardChild) {
        node.wildcardChild = new TrieNode<T>("*", NodeType.WILDCARD);
      }
      return node.wildcardChild;
    }

    const pattern = this.parseSegmentPattern(segment);

    if (pattern) {
      if (!node.paramChild) {
        node.paramChild = new TrieNode<T>(segment, NodeType.PARAM);
        node.paramChild.pattern = pattern;
      }
      return node.paramChild;
    }

    if (segment.startsWith(":")) {
      const paramName = segment.slice(1);
      if (!node.paramChild) {
        node.paramChild = new TrieNode<T>(segment, NodeType.PARAM);
        node.paramChild.paramName = paramName;
      }
      return node.paramChild;
    }

    let child = node.children.get(segment);
    if (!child) {
      child = new TrieNode<T>(segment, NodeType.STATIC);
      node.children.set(segment, child);
    }
    return child;
  }

  /**
   * Optimization: Iterative Matching using a Stack
   * Replaces recursive `matchSegments` to avoid stack overflow and improve performance
   */
  private matchSegmentsIterative(
    root: TrieNode<T>,
    segments: string[],
    params: Record<string, any>
  ): TrieNode<T> | null {
    // Stack stores state: [CurrentNode, SegmentIndex, ParamsSnapshot, BranchToTryNext]
    // BranchToTryNext: 0=Static, 1=Param, 2=Wildcard
    const stack: Array<{
      node: TrieNode<T>;
      index: number;
      paramsSnapshot: Record<string, any>; // Snapshot of params at this level
      phase: number;
    }> = [];

    stack.push({ node: root, index: 0, paramsSnapshot: {}, phase: 0 });

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const { node, index, phase } = current;

      // Check if matched
      if (index === segments.length) {
        if (node.isEndpoint) {
          // Success! Merge params and return node
          Object.assign(params, current.paramsSnapshot);
          return node;
        }
        stack.pop(); // Backtrack
        continue;
      }

      const segment = segments[index];

      // Phase 0: Static Match
      if (phase === 0) {
        current.phase = 1; // Prepare next phase
        const staticChild = node.children.get(segment);
        if (staticChild) {
          stack.push({
            node: staticChild,
            index: index + 1,
            paramsSnapshot: { ...current.paramsSnapshot },
            phase: 0,
          });
          continue;
        }
      }

      // Phase 1: Param Match
      if (phase === 1) {
        current.phase = 2; // Prepare next phase
        if (node.paramChild) {
          const newParams = { ...current.paramsSnapshot };
          let matchFound = false;

          if (node.paramChild.pattern) {
            const extracted = this.extractParamsFromSegment(
              segment,
              node.paramChild.pattern
            );
            if (extracted) {
              Object.assign(newParams, extracted);
              matchFound = true;
            }
          } else if (node.paramChild.paramName) {
            // Simple param (implicit string)
            newParams[node.paramChild.paramName] = segment;
            matchFound = true;
          }

          if (matchFound) {
            stack.push({
              node: node.paramChild,
              index: index + 1,
              paramsSnapshot: newParams,
              phase: 0,
            });
            continue;
          }
        }
      }

      // Phase 2: Wildcard Match
      if (phase === 2) {
        current.phase = 3; // Finished
        if (node.wildcardChild && node.wildcardChild.isEndpoint) {
          // Wildcard matches the rest
          Object.assign(params, current.paramsSnapshot);
          return node.wildcardChild;
        }
      }

      // Phase 3: Exhausted all options
      stack.pop();
    }

    return null;
  }

  private async executeMiddlewareChain(
    ctx: EventContext<T>,
    middleware: Middleware<T>[],
    handler: EventHandler<T>
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < middleware.length) {
        const mw = middleware[index++];
        await mw(ctx, next);
      } else {
        await handler(ctx);
      }
    };

    await next();
  }

  private mergeNode(
    target: TrieNode<T>,
    source: TrieNode<T>,
    prefixSegments: string[]
  ): void {
    let current = target;
    for (const segment of prefixSegments) {
      current = this.insertSegment(current, segment);
    }
    this.deepMergeNode(current, source);
  }

  private deepMergeNode(target: TrieNode<T>, source: TrieNode<T>): void {
    if (source.isEndpoint) {
      target.isEndpoint = true;
      target.handler = source.handler;
      target.middleware = [...target.middleware, ...source.middleware];
      target.guards = [...target.guards, ...source.guards];
      target.schema = source.schema;

      for (const [method, controller] of source.controllers) {
        target.controllers.set(method, controller);
      }
    }

    for (const [key, sourceChild] of source.children) {
      let targetChild = target.children.get(key);
      if (!targetChild) {
        targetChild = new TrieNode<T>(key, NodeType.STATIC);
        target.children.set(key, targetChild);
      }
      this.deepMergeNode(targetChild, sourceChild);
    }

    if (source.paramChild) {
      if (!target.paramChild) {
        target.paramChild = new TrieNode<T>(
          source.paramChild.segment,
          NodeType.PARAM
        );
        target.paramChild.pattern = source.paramChild.pattern;
        target.paramChild.paramName = source.paramChild.paramName;
      }
      this.deepMergeNode(target.paramChild, source.paramChild);
    }

    if (source.wildcardChild) {
      if (!target.wildcardChild) {
        target.wildcardChild = new TrieNode<T>("*", NodeType.WILDCARD);
      }
      this.deepMergeNode(target.wildcardChild, source.wildcardChild);
    }
  }

  private collectRoutes(
    node: TrieNode<T>,
    path: string[],
    routes: string[]
  ): void {
    if (node.isEndpoint) {
      routes.push(path.join(this.delimiter));
    }

    for (const [segment, child] of node.children) {
      this.collectRoutes(child, [...path, segment], routes);
    }

    if (node.paramChild) {
      this.collectRoutes(
        node.paramChild,
        [...path, node.paramChild.segment],
        routes
      );
    }

    if (node.wildcardChild) {
      this.collectRoutes(node.wildcardChild, [...path, "*"], routes);
    }
  }

  private generateUUID(): string {
    // Simple UUID v4 generator for trace IDs
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

// ============================================================================
// Event Client Implementation
// ============================================================================

export interface ClientConfig {
  router?: EventRouter<any>;
  baseChannel?: string;
  timeout?: number;
  metadata?: Record<string, any>;
  adapter?: ClientAdapter;
}

export interface RequestConfig<T = any> {
  channel?: string;
  data?: T;
  metadata?: Record<string, any>;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ClientResponse<T = any> {
  data: T;
  channel: string;
  metadata?: Record<string, any>;
  duration: number;
  traceId: string; // Added traceId
}

export interface ClientError extends Error {
  channel?: string;
  code?: string;
  metadata?: Record<string, any>;
  traceId?: string; // Added traceId
}

export type ClientAdapter = (
  method: HttpMethod | "EMIT",
  channel: string,
  data: any,
  config: RequestConfig
) => Promise<any>;

export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>;

export type ResponseInterceptor = (
  response: ClientResponse
) => ClientResponse | Promise<ClientResponse>;

export type ErrorInterceptor = (
  error: ClientError
) => Promise<ClientError> | never;

export type StreamCallback<T = any> = (
  data: T,
  channel: string
) => void | Promise<void>;

export interface SubscriptionHandle {
  channel: string;
  unsubscribe: () => void;
}

export interface ClientPlugin {
  name: string;
  install: (client: EventClient) => void;
}

export class EventClient {
  private config: Required<ClientConfig>;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];
  private subscriptions: Map<string, Set<StreamCallback>> = new Map();
  private plugins: Map<string, ClientPlugin> = new Map();

  constructor(config: ClientConfig = {}) {
    this.config = {
      router: config.router || new EventRouter(),
      baseChannel: config.baseChannel || "",
      timeout: config.timeout || 30000,
      metadata: config.metadata || {},
      adapter: config.adapter || this.defaultAdapter.bind(this),
    };
  }

  // ==========================================================================
  // HTTP-Style Methods
  // ==========================================================================

  public async get<T = any>(
    channel: string,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("GET", channel, undefined, config);
  }

  public async post<T = any>(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("POST", channel, data, config);
  }

  public async put<T = any>(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("PUT", channel, data, config);
  }

  public async patch<T = any>(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("PATCH", channel, data, config);
  }

  public async delete<T = any>(
    channel: string,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("DELETE", channel, undefined, config);
  }

  public async request<T = any>(
    method: HttpMethod,
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    const startTime = Date.now();
    // Enhancement: Generate traceId if not provided
    const traceId = config?.metadata?.traceId || this.generateUUID();

    let mergedConfig: RequestConfig = {
      channel,
      data,
      metadata: { ...this.config.metadata, ...config?.metadata, traceId },
      timeout: config?.timeout || this.config.timeout,
      signal: config?.signal,
    };

    try {
      for (const interceptor of this.requestInterceptors) {
        mergedConfig = await interceptor(mergedConfig);
      }

      const fullChannel = this.buildChannel(mergedConfig.channel!);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const error = new Error(
            `Request timeout after ${mergedConfig.timeout}ms`
          ) as ClientError;
          error.code = "TIMEOUT";
          error.channel = fullChannel;
          error.traceId = traceId;
          reject(error);
        }, mergedConfig.timeout);
      });

      const abortPromise = mergedConfig.signal
        ? new Promise<never>((_, reject) => {
            mergedConfig.signal!.addEventListener("abort", () => {
              const error = new Error("Request aborted") as ClientError;
              error.code = "ABORTED";
              error.channel = fullChannel;
              error.traceId = traceId;
              reject(error);
            });
          })
        : null;

      const requestPromise = this.config.adapter(
        method,
        fullChannel,
        mergedConfig.data,
        mergedConfig
      );

      const result = await Promise.race(
        [requestPromise, timeoutPromise, abortPromise].filter(
          Boolean
        ) as Promise<any>[]
      );

      let response: ClientResponse<T> = {
        data: result,
        channel: fullChannel,
        metadata: mergedConfig.metadata,
        duration: Date.now() - startTime,
        traceId,
      };

      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      return response;
    } catch (error) {
      let clientError = error as ClientError;
      if (!clientError.channel) {
        clientError.channel = this.buildChannel(mergedConfig.channel!);
      }
      clientError.traceId = traceId;

      for (const interceptor of this.errorInterceptors) {
        clientError = await interceptor(clientError);
      }

      throw clientError;
    }
  }

  // ==========================================================================
  // Event-Driven Methods
  // ==========================================================================

  public async emit(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<void> {
    const fullChannel = this.buildChannel(channel);
    const traceId = config?.metadata?.traceId || this.generateUUID();
    const metadata = { ...this.config.metadata, ...config?.metadata, traceId };

    await this.config.adapter("EMIT", fullChannel, data, {
      ...config,
      metadata,
    });
  }

  public async broadcast(
    channels: string[],
    data?: any,
    config?: RequestConfig
  ): Promise<void> {
    await Promise.all(
      channels.map((channel) => this.emit(channel, data, config))
    );
  }

  // ==========================================================================
  // Streaming Methods
  // ==========================================================================

  public subscribe<T = any>(
    channel: string,
    callback: StreamCallback<T>
  ): SubscriptionHandle {
    const fullChannel = this.buildChannel(channel);

    if (!this.subscriptions.has(fullChannel)) {
      this.subscriptions.set(fullChannel, new Set());
    }

    this.subscriptions.get(fullChannel)!.add(callback as StreamCallback);

    return {
      channel: fullChannel,
      unsubscribe: () => {
        const callbacks = this.subscriptions.get(fullChannel);
        if (callbacks) {
          callbacks.delete(callback as StreamCallback);
          if (callbacks.size === 0) {
            this.subscriptions.delete(fullChannel);
          }
        }
      },
    };
  }

  public async publish<T = any>(channel: string, data: T): Promise<void> {
    const fullChannel = this.buildChannel(channel);
    const callbacks = this.subscriptions.get(fullChannel);

    if (callbacks) {
      await Promise.all(
        Array.from(callbacks).map((callback) => callback(data, fullChannel))
      );
    }
  }

  public unsubscribe(channel: string): void {
    const fullChannel = this.buildChannel(channel);
    this.subscriptions.delete(fullChannel);
  }

  public unsubscribeAll(): void {
    this.subscriptions.clear();
  }

  // ==========================================================================
  // Interceptors & Plugins
  // ==========================================================================

  public interceptors = {
    request: {
      use: (interceptor: RequestInterceptor): void => {
        this.requestInterceptors.push(interceptor);
      },
    },
    response: {
      use: (interceptor: ResponseInterceptor): void => {
        this.responseInterceptors.push(interceptor);
      },
    },
    error: {
      use: (interceptor: ErrorInterceptor): void => {
        this.errorInterceptors.push(interceptor);
      },
    },
  };

  public use(plugin: ClientPlugin): this {
    if (this.plugins.has(plugin.name)) return this;
    plugin.install(this);
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  private buildChannel(channel: string): string {
    if (!this.config.baseChannel) {
      return channel;
    }
    return `${this.config.baseChannel}:${channel}`;
  }

  private async defaultAdapter(
    method: HttpMethod | "EMIT",
    channel: string,
    data: any,
    config: RequestConfig
  ): Promise<any> {
    if (method === "EMIT") {
      await this.config.router.emit(channel, data, config.metadata);
      return undefined;
    }

    return await this.config.router.execute(
      method as HttpMethod,
      channel,
      data,
      config.metadata
    );
  }
}

export function createClient(config?: ClientConfig): EventClient {
  return new EventClient(config);
}

// ============================================================================
// Adapter Infrastructure
// ============================================================================

export interface AdapterRequest {
  method: HttpMethod | "EMIT";
  channel: string;
  data?: any;
  metadata?: Record<string, any>;
  timeout?: number;
}

export interface AdapterResponse<T = any> {
  data: T;
  error?: AdapterError;
}

export interface AdapterError {
  message: string;
  code?: string;
  stack?: string;
}

export interface AdapterConfig {
  name: string;
  version?: string;
  [key: string]: any;
}

export interface StreamMessage<T = any> {
  channel: string;
  data: T;
  timestamp: number;
}

export abstract class BaseAdapter {
  protected config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  abstract request<T = any>(req: AdapterRequest): Promise<T>;
  abstract subscribe(
    channel: string,
    callback: (message: StreamMessage) => void
  ): () => void;
  abstract publish(channel: string, data: any): Promise<void>;
  abstract initialize(): Promise<void>;
  abstract dispose(): Promise<void>;
  abstract isReady(): boolean;
}

export function createAdapterFunction(adapter: BaseAdapter): ClientAdapter {
  return async (method, channel, data, config) => {
    const request: AdapterRequest = {
      method,
      channel,
      data,
      metadata: config.metadata,
      timeout: config.timeout,
    };
    return await adapter.request(request);
  };
}

// ============================================================================
// Electron IPC Adapter
// ============================================================================

export interface ElectronIPCAdapterConfig extends AdapterConfig {
  name: "electron-ipc";
  channelPrefix?: string;
  ipcRenderer?: any;
  ipcMain?: any;
  webContents?: any;
}

export class ElectronIPCRendererAdapter extends BaseAdapter {
  private ipcRenderer: any;
  private channelPrefix: string;
  private subscriptions: Map<string, Set<(msg: StreamMessage) => void>> =
    new Map();
  private initialized: boolean = false;

  constructor(config: ElectronIPCAdapterConfig) {
    super(config);
    if (!config.ipcRenderer) throw new Error("ipcRenderer is required");
    this.ipcRenderer = config.ipcRenderer;
    this.channelPrefix = config.channelPrefix || "event-router";
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.ipcRenderer.on(
      `${this.channelPrefix}:stream`,
      (_event: any, message: StreamMessage) => {
        const callbacks = this.subscriptions.get(message.channel);
        if (callbacks) {
          callbacks.forEach((callback) => callback(message));
        }
      }
    );
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.ipcRenderer.removeAllListeners(`${this.channelPrefix}:stream`);
    this.subscriptions.clear();
    this.initialized = false;
  }

  isReady(): boolean {
    return this.initialized;
  }

  async request<T = any>(req: AdapterRequest): Promise<T> {
    if (!this.initialized) await this.initialize();

    const channelName =
      req.method === "EMIT"
        ? `${this.channelPrefix}:emit`
        : `${this.channelPrefix}:request`;

    try {
      const response: AdapterResponse<T> = await this.ipcRenderer.invoke(
        channelName,
        {
          method: req.method,
          channel: req.channel,
          data: req.data,
          metadata: req.metadata,
        }
      );

      if (response.error) {
        const error = new Error(response.error.message) as ClientError;
        error.code = response.error.code;
        error.channel = req.channel;
        throw error;
      }

      return response.data;
    } catch (error: any) {
      if (error instanceof Error && "code" in error) throw error;
      const clientError = new Error(
        error.message || "IPC request failed"
      ) as ClientError;
      clientError.code = "IPC_ERROR";
      clientError.channel = req.channel;
      throw clientError;
    }
  }

  subscribe(
    channel: string,
    callback: (message: StreamMessage) => void
  ): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(callback);
    this.ipcRenderer.send(`${this.channelPrefix}:subscribe`, { channel });

    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          this.ipcRenderer.send(`${this.channelPrefix}:unsubscribe`, {
            channel,
          });
        }
      }
    };
  }

  async publish(channel: string, data: any): Promise<void> {
    if (!this.initialized) await this.initialize();
    await this.ipcRenderer.invoke(`${this.channelPrefix}:publish`, {
      channel,
      data,
    });
  }
}

export class ElectronIPCMainAdapter extends BaseAdapter {
  private ipcMain: any;
  private webContents: any;
  private router: EventRouter<any>;
  private channelPrefix: string;
  private subscriptions: Map<number, Set<string>> = new Map(); // webContentsId -> channels
  private initialized: boolean = false;

  constructor(config: ElectronIPCAdapterConfig & { router: EventRouter<any> }) {
    super(config);
    if (!config.ipcMain) throw new Error("ipcMain is required");
    if (!config.router) throw new Error("router is required");

    this.ipcMain = config.ipcMain;
    this.webContents = config.webContents;
    this.router = config.router;
    this.channelPrefix = config.channelPrefix || "event-router";
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Handler: Request/Response
    this.ipcMain.handle(
      `${this.channelPrefix}:request`,
      async (_event: any, req: AdapterRequest) => {
        try {
          const result = await this.router.execute(
            req.method as HttpMethod,
            req.channel,
            req.data,
            req.metadata
          );
          return { data: result } as AdapterResponse;
        } catch (error: any) {
          return {
            data: null,
            error: {
              message: error.message,
              code: error.code || "ROUTER_ERROR",
            },
          } as AdapterResponse;
        }
      }
    );

    // Handler: Emit
    this.ipcMain.handle(
      `${this.channelPrefix}:emit`,
      async (_event: any, req: AdapterRequest) => {
        try {
          await this.router.emit(req.channel, req.data, req.metadata);
          return { data: null } as AdapterResponse;
        } catch (error: any) {
          return {
            data: null,
            error: {
              message: error.message,
              code: error.code || "ROUTER_ERROR",
            },
          } as AdapterResponse;
        }
      }
    );

    // Handler: Subscribe
    this.ipcMain.on(
      `${this.channelPrefix}:subscribe`,
      (event: any, { channel }: { channel: string }) => {
        const webContentsId = event.sender.id;
        if (!this.subscriptions.has(webContentsId)) {
          this.subscriptions.set(webContentsId, new Set());

          // Enhancement: Robust Cleanup on WebContents Destroy
          event.sender.once("destroyed", () => {
            this.subscriptions.delete(webContentsId);
          });
        }
        this.subscriptions.get(webContentsId)!.add(channel);
      }
    );

    // Handler: Unsubscribe
    this.ipcMain.on(
      `${this.channelPrefix}:unsubscribe`,
      (event: any, { channel }: { channel: string }) => {
        const webContentsId = event.sender.id;
        const channels = this.subscriptions.get(webContentsId);
        if (channels) {
          channels.delete(channel);
          if (channels.size === 0) this.subscriptions.delete(webContentsId);
        }
      }
    );

    // Handler: Publish
    this.ipcMain.handle(
      `${this.channelPrefix}:publish`,
      async (_event: any, { channel, data }: any) => {
        await this.publish(channel, data);
        return { data: null } as AdapterResponse;
      }
    );

    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.ipcMain.removeHandler(`${this.channelPrefix}:request`);
    this.ipcMain.removeHandler(`${this.channelPrefix}:emit`);
    this.ipcMain.removeHandler(`${this.channelPrefix}:publish`);
    this.subscriptions.clear();
    this.initialized = false;
  }

  isReady(): boolean {
    return this.initialized;
  }

  async request<T = any>(req: AdapterRequest): Promise<T> {
    if (req.method === "EMIT") {
      await this.router.emit(req.channel, req.data, req.metadata);
      return undefined as T;
    }
    return await this.router.execute(
      req.method as HttpMethod,
      req.channel,
      req.data,
      req.metadata
    );
  }

  subscribe(
    channel: string,
    callback: (message: StreamMessage) => void
  ): () => void {
    // simplified for main process subscription
    return () => {};
  }

  async publish(channel: string, data: any): Promise<void> {
    const message: StreamMessage = { channel, data, timestamp: Date.now() };

    for (const [webContentsId, channels] of this.subscriptions) {
      if (this.matchesChannel(channel, channels)) {
        try {
          const wc = this.webContents?.fromId?.(webContentsId);
          if (wc && !wc.isDestroyed()) {
            wc.send(`${this.channelPrefix}:stream`, message);
          } else {
            this.subscriptions.delete(webContentsId);
          }
        } catch (error) {
          this.subscriptions.delete(webContentsId);
        }
      }
    }
  }

  private matchesChannel(channel: string, subscribed: Set<string>): boolean {
    if (subscribed.has(channel)) return true;
    for (const pattern of subscribed) {
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        if (channel.startsWith(prefix)) return true;
      }
    }
    return false;
  }
}

// ============================================================================
// Adapter Factory
// ============================================================================

export class AdapterFactory {
  private static adapters: Map<string, new (config: any) => BaseAdapter> =
    new Map();

  static register(
    name: string,
    adapterClass: new (config: any) => BaseAdapter
  ): void {
    this.adapters.set(name, adapterClass);
  }

  static create(config: AdapterConfig): BaseAdapter {
    const AdapterClass = this.adapters.get(config.name);
    if (!AdapterClass) throw new Error(`Unknown adapter: ${config.name}`);
    return new AdapterClass(config);
  }
}

AdapterFactory.register("electron-ipc-renderer", ElectronIPCRendererAdapter);
AdapterFactory.register("electron-ipc-main", ElectronIPCMainAdapter);
