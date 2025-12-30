/**
 * Enterprise-grade Event Router with Trie-based routing
 * Supports static, parametric, and wildcard event channels
 * Optimized for high-performance lookups and modularity
 * * Includes EventClient for axios-like client-side interaction
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface EventContext<T = any> {
  channel: string;
  params: Record<string, string>;
  event: T;
  metadata?: Record<string, any>;
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

export interface RouteConfig<T = any> {
  handler: EventHandler<T>;
  middleware?: Middleware<T>[];
  guards?: Guard<T>[];
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ControllerValue {
  [key: string]: any;
}

export type Controller<T = any> = EventHandler<T> | ControllerValue;

export type ParamType = "string" | "number" | "boolean" | "datetime" | "uuid";

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
  params: Record<string, string>;
  middleware: Middleware<T>[];
  guards: Guard<T>[];
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

  constructor(delimiter: string = ":") {
    this.root = new TrieNode<T>();
    this.delimiter = delimiter;
  }

  /**
   * Register a route with handler, middleware, and guards
   */
  public on(
    channel: string,
    handler: EventHandler<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
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

    const ctx: EventContext<T> = {
      channel,
      params: match.params,
      event,
      metadata,
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
    const match = this.matchController(channel, method);

    if (!match) {
      throw new Error(`No ${method} controller found for channel: ${channel}`);
    }

    const ctx: EventContext<T> = {
      channel,
      params: match.params,
      event,
      metadata,
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
   */
  public match(channel: string): RouteMatch<T> | null {
    const segments = this.parseChannel(channel);
    const params: Record<string, string> = {};
    const node = this.matchSegments(this.root, segments, 0, params);

    if (!node || !node.isEndpoint || !node.handler) {
      return null;
    }

    return {
      handler: node.handler,
      params,
      middleware: node.middleware,
      guards: node.guards,
    };
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

  private registerController(
    channel: string,
    method: HttpMethod,
    controller: Controller<T>,
    config?: Omit<RouteConfig<T>, "handler">
  ): this {
    const segments = this.parseChannel(channel);
    let node = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      node = this.insertSegment(node, segment);
    }

    node.isEndpoint = true;
    node.controllers.set(method, controller);

    // Merge middleware and guards if provided
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
    params: Record<string, string>;
    middleware: Middleware<T>[];
    guards: Guard<T>[];
  } | null {
    const segments = this.parseChannel(channel);
    const params: Record<string, string> = {};
    const node = this.matchSegments(this.root, segments, 0, params);

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
      return null; // No parameters found
    }

    // Build regex pattern for matching
    let regexPattern = "^";
    let lastIndex = 0;

    for (const param of params) {
      // Add literal text before parameter
      if (param.position[0] > lastIndex) {
        const literal = segment.substring(lastIndex, param.position[0]);
        // FIXED: Use proper escape sequence \\$& for special regex characters
        regexPattern += literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      // Add capture group based on type
      const capturePattern = this.getTypePattern(param.type);
      regexPattern += `(${capturePattern})`;

      lastIndex = param.position[1];
    }

    // Add remaining literal text
    if (lastIndex < segment.length) {
      const literal = segment.substring(lastIndex);
      regexPattern += literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    regexPattern += "$";

    return {
      raw: segment,
      params,
      regex: new RegExp(regexPattern),
    };
  }

  private getTypePattern(type?: ParamType): string {
    switch (type) {
      case "number":
        return "-?\\d+(?:\\.\\d+)?";
      case "boolean":
        return "true|false";
      case "datetime":
        return "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})?";
      case "uuid":
        return "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
      case "string":
      default:
        return "[^:]+"; // Match anything except delimiter
    }
  }

  private extractParamsFromSegment(
    segment: string,
    pattern: SegmentPattern
  ): Record<string, string> | null {
    if (!pattern.regex) {
      return null;
    }

    const match = pattern.regex.exec(segment);
    if (!match) {
      return null;
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < pattern.params.length; i++) {
      const param = pattern.params[i];
      params[param.name] = match[i + 1]; // +1 because match[0] is full string
    }

    return params;
  }

  private insertSegment(node: TrieNode<T>, segment: string): TrieNode<T> {
    // Wildcard segment (*)
    if (segment === "*") {
      if (!node.wildcardChild) {
        node.wildcardChild = new TrieNode<T>("*", NodeType.WILDCARD);
      }
      return node.wildcardChild;
    }

    // Check for parametric segment with brackets (Complex)
    const pattern = this.parseSegmentPattern(segment);

    if (pattern) {
      // Complex parametric segment with one or more parameters
      if (!node.paramChild) {
        node.paramChild = new TrieNode<T>(segment, NodeType.PARAM);
        node.paramChild.pattern = pattern;
      }
      return node.paramChild;
    }

    // Parametric segment (:param) (Simple legacy support if needed, or simple brackets)
    // Note: The spec prefers bracket notation, but simple :param is often standard.
    // The parseSegmentPattern handles brackets. If we have a simple :param without brackets:
    if (segment.startsWith(":")) {
      const paramName = segment.slice(1);
      if (!node.paramChild) {
        node.paramChild = new TrieNode<T>(segment, NodeType.PARAM);
        node.paramChild.paramName = paramName;
      }
      return node.paramChild;
    }

    // Static segment
    let child = node.children.get(segment);
    if (!child) {
      child = new TrieNode<T>(segment, NodeType.STATIC);
      node.children.set(segment, child);
    }
    return child;
  }

  private matchSegments(
    node: TrieNode<T>,
    segments: string[],
    index: number,
    params: Record<string, string>
  ): TrieNode<T> | null {
    // Reached the end of segments
    if (index === segments.length) {
      return node.isEndpoint ? node : null;
    }

    const segment = segments[index];

    // Priority 1: Static match (most specific)
    const staticChild = node.children.get(segment);
    if (staticChild) {
      const result = this.matchSegments(
        staticChild,
        segments,
        index + 1,
        params
      );
      if (result) return result;
    }

    // Priority 2: Parametric match
    if (node.paramChild) {
      const paramsCopy = { ...params };
      let matchFound = false;

      // Case A: Complex Pattern (brackets)
      if (node.paramChild.pattern) {
        const extractedParams = this.extractParamsFromSegment(
          segment,
          node.paramChild.pattern
        );

        if (extractedParams) {
          Object.assign(paramsCopy, extractedParams);
          matchFound = true;
        }
      }
      // Case B: Simple Param (colon or single bracket implicit)
      else if (node.paramChild.paramName) {
        paramsCopy[node.paramChild.paramName] = segment;
        matchFound = true;
      }

      if (matchFound) {
        const result = this.matchSegments(
          node.paramChild,
          segments,
          index + 1,
          paramsCopy
        );
        if (result) {
          Object.assign(params, paramsCopy);
          return result;
        }
      }
    }

    // Priority 3: Wildcard match (least specific, matches rest of path)
    if (node.wildcardChild && node.wildcardChild.isEndpoint) {
      return node.wildcardChild;
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
    // Navigate to prefix location or create it
    let current = target;
    for (const segment of prefixSegments) {
      current = this.insertSegment(current, segment);
    }

    // Recursively merge the source tree
    this.deepMergeNode(current, source);
  }

  private deepMergeNode(target: TrieNode<T>, source: TrieNode<T>): void {
    // Merge endpoint data
    if (source.isEndpoint) {
      target.isEndpoint = true;
      target.handler = source.handler;
      target.middleware = [...target.middleware, ...source.middleware];
      target.guards = [...target.guards, ...source.guards];

      // Merge controllers
      for (const [method, controller] of source.controllers) {
        target.controllers.set(method, controller);
      }
    }

    // Merge static children
    for (const [key, sourceChild] of source.children) {
      let targetChild = target.children.get(key);
      if (!targetChild) {
        targetChild = new TrieNode<T>(key, NodeType.STATIC);
        target.children.set(key, targetChild);
      }
      this.deepMergeNode(targetChild, sourceChild);
    }

    // Merge param child
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

    // Merge wildcard child
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
}

// ============================================================================
// Event Client Implementation (Axios-like)
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
}

export interface ClientError extends Error {
  channel?: string;
  code?: string;
  metadata?: Record<string, any>;
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

/**
 * EventClient - Axios-like client for EventRouter
 * Provides request/response, streaming, and full-duplex communication
 */
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
  // HTTP-Style Methods (Request/Response)
  // ==========================================================================

  /**
   * GET request
   */
  public async get<T = any>(
    channel: string,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("GET", channel, undefined, config);
  }

  /**
   * POST request
   */
  public async post<T = any>(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("POST", channel, data, config);
  }

  /**
   * PUT request
   */
  public async put<T = any>(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("PUT", channel, data, config);
  }

  /**
   * PATCH request
   */
  public async patch<T = any>(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("PATCH", channel, data, config);
  }

  /**
   * DELETE request
   */
  public async delete<T = any>(
    channel: string,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    return this.request<T>("DELETE", channel, undefined, config);
  }

  /**
   * Generic request method
   */
  public async request<T = any>(
    method: HttpMethod,
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ClientResponse<T>> {
    const startTime = Date.now();
    let mergedConfig: RequestConfig = {
      channel,
      data,
      metadata: { ...this.config.metadata, ...config?.metadata },
      timeout: config?.timeout || this.config.timeout,
      signal: config?.signal,
    };

    try {
      // Apply request interceptors
      for (const interceptor of this.requestInterceptors) {
        mergedConfig = await interceptor(mergedConfig);
      }

      const fullChannel = this.buildChannel(mergedConfig.channel!);

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const error = new Error(
            `Request timeout after ${mergedConfig.timeout}ms`
          ) as ClientError;
          error.code = "TIMEOUT";
          error.channel = fullChannel;
          reject(error);
        }, mergedConfig.timeout);
      });

      // Create abort promise
      const abortPromise = mergedConfig.signal
        ? new Promise<never>((_, reject) => {
            mergedConfig.signal!.addEventListener("abort", () => {
              const error = new Error("Request aborted") as ClientError;
              error.code = "ABORTED";
              error.channel = fullChannel;
              reject(error);
            });
          })
        : null;

      // Execute request
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
      };

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response);
      }

      return response;
    } catch (error) {
      // Apply error interceptors
      let clientError = error as ClientError;
      if (!clientError.channel) {
        clientError.channel = this.buildChannel(mergedConfig.channel!);
      }

      for (const interceptor of this.errorInterceptors) {
        clientError = await interceptor(clientError);
      }

      throw clientError;
    }
  }

  // ==========================================================================
  // Event-Driven Methods (Fire and Forget)
  // ==========================================================================

  /**
   * Emit an event (fire and forget)
   */
  public async emit(
    channel: string,
    data?: any,
    config?: RequestConfig
  ): Promise<void> {
    const fullChannel = this.buildChannel(channel);
    const metadata = { ...this.config.metadata, ...config?.metadata };

    await this.config.adapter("EMIT", fullChannel, data, {
      ...config,
      metadata,
    });
  }

  /**
   * Broadcast to multiple channels
   */
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
  // Streaming Methods (SSE-like)
  // ==========================================================================

  /**
   * Subscribe to a channel for streaming events
   */
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

  /**
   * Publish data to all subscribers of a channel
   */
  public async publish<T = any>(channel: string, data: T): Promise<void> {
    const fullChannel = this.buildChannel(channel);
    const callbacks = this.subscriptions.get(fullChannel);

    if (callbacks) {
      await Promise.all(
        Array.from(callbacks).map((callback) => callback(data, fullChannel))
      );
    }
  }

  /**
   * Unsubscribe from all subscriptions on a channel
   */
  public unsubscribe(channel: string): void {
    const fullChannel = this.buildChannel(channel);
    this.subscriptions.delete(fullChannel);
  }

  /**
   * Unsubscribe from all channels
   */
  public unsubscribeAll(): void {
    this.subscriptions.clear();
  }

  // ==========================================================================
  // Interceptors
  // ==========================================================================

  public interceptors = {
    request: {
      use: (interceptor: RequestInterceptor): void => {
        this.requestInterceptors.push(interceptor);
      },
      eject: (interceptor: RequestInterceptor): void => {
        const index = this.requestInterceptors.indexOf(interceptor);
        if (index > -1) {
          this.requestInterceptors.splice(index, 1);
        }
      },
    },
    response: {
      use: (interceptor: ResponseInterceptor): void => {
        this.responseInterceptors.push(interceptor);
      },
      eject: (interceptor: ResponseInterceptor): void => {
        const index = this.responseInterceptors.indexOf(interceptor);
        if (index > -1) {
          this.responseInterceptors.splice(index, 1);
        }
      },
    },
    error: {
      use: (interceptor: ErrorInterceptor): void => {
        this.errorInterceptors.push(interceptor);
      },
      eject: (interceptor: ErrorInterceptor): void => {
        const index = this.errorInterceptors.indexOf(interceptor);
        if (index > -1) {
          this.errorInterceptors.splice(index, 1);
        }
      },
    },
  };

  // ==========================================================================
  // Plugin System
  // ==========================================================================

  /**
   * Install a plugin
   */
  public use(plugin: ClientPlugin): this {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} is already installed`);
      return this;
    }

    plugin.install(this);
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  /**
   * Check if a plugin is installed
   */
  public hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get installed plugin
   */
  public getPlugin(name: string): ClientPlugin | undefined {
    return this.plugins.get(name);
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Create a new client instance with merged config
   */
  public create(config: Partial<ClientConfig>): EventClient {
    return new EventClient({
      router: config.router || this.config.router,
      baseChannel: config.baseChannel || this.config.baseChannel,
      timeout: config.timeout || this.config.timeout,
      metadata: { ...this.config.metadata, ...config.metadata },
      adapter: config.adapter || this.config.adapter,
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<ClientConfig> {
    return { ...this.config };
  }

  /**
   * Get the router instance
   */
  public getRouter(): EventRouter<any> {
    return this.config.router;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

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

/**
 * Create a new EventClient instance
 */
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

/**
 * Base Adapter class that all adapters should extend
 */
export abstract class BaseAdapter {
  protected config: AdapterConfig;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  /**
   * Execute a request through the adapter
   */
  abstract request<T = any>(req: AdapterRequest): Promise<T>;

  /**
   * Subscribe to a channel for streaming messages
   */
  abstract subscribe(
    channel: string,
    callback: (message: StreamMessage) => void
  ): () => void;

  /**
   * Publish a message to a channel
   */
  abstract publish(channel: string, data: any): Promise<void>;

  /**
   * Initialize the adapter (called once during setup)
   */
  abstract initialize(): Promise<void>;

  /**
   * Cleanup resources (called during shutdown)
   */
  abstract dispose(): Promise<void>;

  /**
   * Get adapter configuration
   */
  public getConfig(): AdapterConfig {
    return { ...this.config };
  }

  /**
   * Check if adapter is ready
   */
  abstract isReady(): boolean;
}

/**
 * Create an adapter function for EventClient from BaseAdapter instance
 */
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
  ipcRenderer?: any; // Electron's ipcRenderer
  ipcMain?: any; // Electron's ipcMain (for main process)
  webContents?: any; // Electron's webContents (for main process)
}

/**
 * Electron IPC Adapter for Renderer Process (Client Side)
 */
export class ElectronIPCRendererAdapter extends BaseAdapter {
  private ipcRenderer: any;
  private channelPrefix: string;
  private subscriptions: Map<string, Set<(msg: StreamMessage) => void>> =
    new Map();
  private initialized: boolean = false;

  constructor(config: ElectronIPCAdapterConfig) {
    super(config);

    if (!config.ipcRenderer) {
      throw new Error("ipcRenderer is required for ElectronIPCRendererAdapter");
    }

    this.ipcRenderer = config.ipcRenderer;
    this.channelPrefix = config.channelPrefix || "event-router";
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Set up listener for streaming messages
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
    // Remove all listeners
    this.ipcRenderer.removeAllListeners(`${this.channelPrefix}:stream`);
    this.subscriptions.clear();
    this.initialized = false;
  }

  isReady(): boolean {
    return this.initialized;
  }

  async request<T = any>(req: AdapterRequest): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

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
      if (error instanceof Error && "code" in error) {
        throw error;
      }

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

    // Notify main process of subscription
    this.ipcRenderer.send(`${this.channelPrefix}:subscribe`, { channel });

    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          // Notify main process of unsubscription
          this.ipcRenderer.send(`${this.channelPrefix}:unsubscribe`, {
            channel,
          });
        }
      }
    };
  }

  async publish(channel: string, data: any): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.ipcRenderer.invoke(`${this.channelPrefix}:publish`, {
      channel,
      data,
    });
  }
}

/**
 * Electron IPC Adapter for Main Process (Server Side)
 */
export class ElectronIPCMainAdapter extends BaseAdapter {
  private ipcMain: any;
  private webContents: any;
  private router: EventRouter<any>;
  private channelPrefix: string;
  private subscriptions: Map<number, Set<string>> = new Map(); // webContentsId -> channels
  private initialized: boolean = false;

  constructor(config: ElectronIPCAdapterConfig & { router: EventRouter<any> }) {
    super(config);

    if (!config.ipcMain) {
      throw new Error("ipcMain is required for ElectronIPCMainAdapter");
    }

    if (!config.router) {
      throw new Error("router is required for ElectronIPCMainAdapter");
    }

    this.ipcMain = config.ipcMain;
    this.webContents = config.webContents;
    this.router = config.router;
    this.channelPrefix = config.channelPrefix || "event-router";
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Handle request/response
    this.ipcMain.handle(
      `${this.channelPrefix}:request`,
      async (_event: any, request: AdapterRequest) => {
        try {
          const result = await this.router.execute(
            request.method as HttpMethod,
            request.channel,
            request.data,
            request.metadata
          );

          return { data: result } as AdapterResponse;
        } catch (error: any) {
          return {
            data: null,
            error: {
              message: error.message,
              code: error.code || "ROUTER_ERROR",
              stack: error.stack,
            },
          } as AdapterResponse;
        }
      }
    );

    // Handle emit (fire and forget)
    this.ipcMain.handle(
      `${this.channelPrefix}:emit`,
      async (_event: any, request: AdapterRequest) => {
        try {
          await this.router.emit(
            request.channel,
            request.data,
            request.metadata
          );

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

    // Handle subscribe
    this.ipcMain.on(
      `${this.channelPrefix}:subscribe`,
      (event: any, { channel }: { channel: string }) => {
        const webContentsId = event.sender.id;

        if (!this.subscriptions.has(webContentsId)) {
          this.subscriptions.set(webContentsId, new Set());
        }

        this.subscriptions.get(webContentsId)!.add(channel);
      }
    );

    // Handle unsubscribe
    this.ipcMain.on(
      `${this.channelPrefix}:unsubscribe`,
      (event: any, { channel }: { channel: string }) => {
        const webContentsId = event.sender.id;
        const channels = this.subscriptions.get(webContentsId);

        if (channels) {
          channels.delete(channel);
          if (channels.size === 0) {
            this.subscriptions.delete(webContentsId);
          }
        }
      }
    );

    // Handle publish
    this.ipcMain.handle(
      `${this.channelPrefix}:publish`,
      async (
        _event: any,
        { channel, data }: { channel: string; data: any }
      ) => {
        await this.publish(channel, data);
        return { data: null } as AdapterResponse;
      }
    );

    this.initialized = true;
  }

  async dispose(): Promise<void> {
    // Remove all handlers
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
    // Main process can directly execute on router
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
    // For main process, we can directly listen to router events
    // This is a simplified implementation
    const handler = async (ctx: EventContext) => {
      if (ctx.channel === channel || this.router.has(channel)) {
        callback({
          channel: ctx.channel,
          data: ctx.event,
          timestamp: Date.now(),
        });
      }
    };

    // Note: This is a conceptual implementation
    // In practice, you'd need to enhance the router to support event listeners
    return () => {
      // Cleanup
    };
  }

  async publish(channel: string, data: any): Promise<void> {
    const message: StreamMessage = {
      channel,
      data,
      timestamp: Date.now(),
    };

    // Send to all subscribed renderer processes
    for (const [webContentsId, channels] of this.subscriptions) {
      if (this.matchesChannel(channel, channels)) {
        try {
          // Get webContents by ID
          const wc = this.webContents?.fromId?.(webContentsId);
          if (wc && !wc.isDestroyed()) {
            wc.send(`${this.channelPrefix}:stream`, message);
          } else {
            // Cleanup dead webContents
            this.subscriptions.delete(webContentsId);
          }
        } catch (error) {
          console.error("Failed to send to webContents:", error);
          this.subscriptions.delete(webContentsId);
        }
      }
    }
  }

  private matchesChannel(channel: string, subscribed: Set<string>): boolean {
    // Exact match
    if (subscribed.has(channel)) return true;

    // Check for wildcard matches
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

  /**
   * Register a new adapter type
   */
  static register(
    name: string,
    adapterClass: new (config: any) => BaseAdapter
  ): void {
    this.adapters.set(name, adapterClass);
  }

  /**
   * Create an adapter instance
   */
  static create(config: AdapterConfig): BaseAdapter {
    const AdapterClass = this.adapters.get(config.name);

    if (!AdapterClass) {
      throw new Error(`Unknown adapter: ${config.name}`);
    }

    return new AdapterClass(config);
  }

  /**
   * Get all registered adapter names
   */
  static getRegistered(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Register built-in adapters
AdapterFactory.register("electron-ipc-renderer", ElectronIPCRendererAdapter);
AdapterFactory.register("electron-ipc-main", ElectronIPCMainAdapter);
