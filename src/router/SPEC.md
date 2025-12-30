# Event-Driven Application Router - Technical Specification

## Project Overview

An enterprise-grade, event-driven application orchestrator with a high-performance router system for TypeScript applications. The system provides HTTP-like API semantics for event-based architectures, supporting request/response patterns, fire-and-forget events, and full-duplex streaming communication.

## Core Architecture

### 1. Event Router (Server-Side)

**Purpose**: Central routing engine that matches event channels to handlers using a Trie-based structure for O(k) lookup performance.

**Key Features**:

- **Trie-based routing**: Optimal performance for complex channel structures.
- **Iterative Matcher**: Stack-based matching algorithm (non-recursive) to prevent stack overflows and improve execution speed.
- **LRU Match Caching**: O(1) resolution for "hot" event channels using a Least Recently Used cache.
- **HTTP-style method controllers**: Supports GET, POST, PUT, PATCH, DELETE.
- **Middleware pipeline**: Standard `next()` pattern for cross-cutting concerns (logging, auth, etc.).
- **Guard functions**: Pre-execution authorization and logic-based rejection.
- **Schema Validation**: Built-in support for Zod, Joi, or Yup for runtime payload integrity.

**Channel Format**: `{feature}:{action}:[param?]`

- Delimiter: `:` (configurable)
- Example: `user:profile:[userId]`, `notification:sent`, `updates:*`

### 2. Parametric Routing System

**Bracket Notation**: `[paramName]` or `[paramName:type]`

**Supported Types & Coercion**:

- `string`: Default, matches any characters except delimiter.
- `number`: Integers and decimals. Coerced to JS `number`.
- `boolean`: Matches `true` or `false`. Coerced to JS `boolean`.
- `datetime`: ISO 8601 strings. Coerced to JS `Date` object.
- `uuid`: Standard UUID v4/v5 validation.
- `email`: Basic RFC 5322 validation.
- `slug`: URL-friendly lowercase-hyphenated strings.
- `ipv4`: Validated IPv4 address matching.
- `alpha/alphanumeric`: Strict character set validation.

**Regex Optimization**: Compiled regex patterns are cached globally to reduce memory overhead and initialization time.

**Advanced Features**:

- **Multiple parameters per segment**: `[startTime:datetime]-[endTime:datetime]`
- **Any delimiter except colon**: `[hour:number].[minute:number]`, `[name]_v[version:number]`
- **Parameters across segments**: `booking:[startTime]:[duration:number]`

**Examples**:

```typescript
router.get("user:profile:[userId:uuid]", handler);
router.get("range:[start:datetime]-[end:datetime]", handler);
router.get("time:[hour:number].[minute:number]", handler);
router.get("file:[name]_v[version:number].json", handler);
```

### 3. Event Client (Client-Side)

**Purpose**: Axios-inspired client for interacting with the Event Router across process boundaries.

**Features**:

- **Interceptors**: Global request, response, and error hooks.
- **Observability**: Automatic `traceId` generation and propagation for distributed tracing.
- **Timeouts & AbortSignal**: Native support for request cancellation and expiration.
- **Plugin System**: Modular architecture for extending client capabilities.

**Communication Patterns**:

#### A. Request/Response (HTTP-style)

```typescript
const profile = await client.get("user:profile:123");
const newUser = await client.post("user:create", { name: "Alice" });
const config = await client.put("config:settings", data);
const updated = await client.patch("user:update:123", changes);
const deleted = await client.delete("user:delete:123");
```

#### B. Fire-and-Forget (Event-driven)

```typescript
await client.emit("notification:sent", { type: "email" });
await client.broadcast(["channel1", "channel2"], data);
```

#### C. Streaming (SSE-like)

```typescript
const subscription = client.subscribe("updates:user:123", (data) => {
  console.log("Update:", data);
});

await client.publish("updates:user:123", { status: "online" });
subscription.unsubscribe();
```

**Client Features**:

- Request/response/error interceptors (axios-style)
- Timeout support (per-request and global)
- Abort signals (AbortController)
- Base channel prefixing
- Custom metadata attachment
- Scoped client creation
- Plugin system for extensibility

### 4. Adapter Infrastructure

## Adapter System

**Purpose**: Pluggable transport layer that separates communication protocol from business logic. The system uses a pluggable adapter architecture to abstract the communication layer.

### Electron IPC Adapters

- **Main Adapter**: Manages subscriptions and routes events from Renderer processes.
- **Renderer Adapter**: Proxies requests to the Main process via `ipcRenderer.invoke`.
- **Memory Safety**: Includes proactive cleanup of `webContents` references upon process destruction to prevent memory leaks.

**BaseAdapter Abstract Class**:

```typescript
abstract class BaseAdapter {
  abstract request<T>(req: AdapterRequest): Promise<T>;
  abstract subscribe(channel: string, callback: Function): () => void;
  abstract publish(channel: string, data: any): Promise<void>;
  abstract initialize(): Promise<void>;
  abstract dispose(): Promise<void>;
  abstract isReady(): boolean;
}
```

**Adapter Pattern Benefits**:

- Transport layer abstraction
- Easy to add new protocols (WebSocket, HTTP, gRPC, Message Queue)
- Consistent API regardless of underlying transport
- Testability and mocking

### 5. Electron IPC Adapter (Reference Implementation)

**ElectronIPCRendererAdapter** (Client-Side):

- Uses `ipcRenderer.invoke()` for request/response
- Uses `ipcRenderer.send()` for subscriptions
- Listens on `ipcRenderer.on()` for streaming messages
- Automatic initialization and cleanup

**ElectronIPCMainAdapter** (Server-Side):

- Handles IPC requests and routes to EventRouter
- Manages subscriptions per webContents
- Broadcasts messages to subscribed renderer processes
- Wildcard channel matching support
- Automatic cleanup of destroyed webContents

**IPC Channels**:

- `{prefix}:request` - HTTP-style requests (GET, POST, etc.)
- `{prefix}:emit` - Fire-and-forget events
- `{prefix}:publish` - Publish to subscribers
- `{prefix}:stream` - Receive streaming messages
- `{prefix}:subscribe` - Subscribe to channel
- `{prefix}:unsubscribe` - Unsubscribe from channel

## Technical Implementation Details

### Trie Node Structure

```typescript
class TrieNode<T> {
  type: NodeType; // STATIC, PARAM, WILDCARD
  segment: string;
  pattern?: SegmentPattern; // For parametric segments
  children: Map<string, TrieNode<T>>;
  paramChild?: TrieNode<T>;
  wildcardChild?: TrieNode<T>;
  handler?: EventHandler<T>;
  controllers: Map<HttpMethod, Controller<T>>;
  middleware: Middleware<T>[];
  guards: Guard<T>[];
  isEndpoint: boolean;
}
```

### Matching Priority

1. **Static match** (exact string) - Most specific
2. **Parametric match** (with pattern validation) - Medium specificity
3. **Wildcard match** (`*`) - Least specific, catches all

### Parameter Parsing Algorithm

1. Extract all `[param]` or `[param:type]` patterns using regex
2. Build regex pattern by:
   - Escaping literal text between parameters
   - Inserting type-specific capture groups
   - Preserving delimiters within segments
3. Compile regex for runtime matching
4. Extract parameter values during route matching

### Middleware Chain Execution

```typescript
// Middleware executes in order with next() pattern
router.use(middleware1);
router.use(middleware2);
router.on("channel", handler, { middleware: [middleware3] });

// Execution order: global1 -> global2 -> local3 -> handler
```

### Router Composition

```typescript
const userRouter = new EventRouter();
userRouter.get("profile:[id]", handler);

const mainRouter = new EventRouter();
mainRouter.merge(userRouter, "user"); // Prefixes all routes with 'user:'
// Results in: 'user:profile:[id]'
```

## Use Cases

### 1. Electron Desktop Applications

- Main process hosts router with business logic
- Renderer processes use client with IPC adapter
- Full bidirectional communication
- Multiple windows can subscribe to same channels

### 2. Microservices Communication

- Each service hosts a router
- Services communicate via adapters (HTTP, gRPC, Message Queue)
- Event-driven architecture with type safety

### 3. Modular Monoliths

- Feature modules register routes
- Central router composes all modules
- Clear boundaries between features
- Easy to extract to microservices later

### 4. Real-time Applications

- WebSocket adapter for browser clients
- Streaming subscriptions for live updates
- Request/response for queries
- Emit for fire-and-forget notifications

## Project Status

### Completed Components

- ✅ EventRouter with Trie-based routing
- ✅ Parametric routing with bracket notation and type validation
- ✅ HTTP-style method controllers (GET, POST, PUT, PATCH, DELETE)
- ✅ Middleware and guard system
- ✅ Router composition and merging
- ✅ EventClient with axios-like API
- ✅ Interceptor system (request/response/error)
- ✅ Streaming subscriptions
- ✅ BaseAdapter abstract class
- ✅ AdapterFactory registry
- ✅ Electron IPC adapter (both renderer and main process)

### Pending Work

- Additional adapters (WebSocket, HTTP REST, gRPC, Redis Pub/Sub)
- Comprehensive test suite
- Performance benchmarks
- Documentation and examples
- Plugin ecosystem development
- Error recovery and retry strategies
- Circuit breaker pattern
- Rate limiting
- Request tracing and observability

## Code Structure

```text
event-router/
├── router/
│   ├── EventRouter.ts          # Main router class
│   ├── TrieNode.ts              # Trie node implementation
│   └── types.ts                 # Type definitions
├── client/
│   ├── EventClient.ts           # Client implementation
│   └── types.ts                 # Client types
├── adapters/
│   ├── BaseAdapter.ts           # Abstract adapter class
│   ├── AdapterFactory.ts        # Adapter registry
│   ├── ElectronIPCRenderer.ts   # Electron renderer adapter
│   └── ElectronIPCMain.ts       # Electron main adapter
└── examples/
    ├── electron/                # Electron app example
    ├── basic/                   # Basic usage examples
    └── advanced/                # Advanced patterns
```

## Key Design Decisions

1. **Trie over Hash Maps**: O(k) lookup where k is segment count, handles wildcards efficiently
2. **Bracket notation over colon**: More flexible, supports multiple params per segment
3. **Type validation at parse time**: Compile regex once, validate on every match
4. **Adapter pattern**: Clean separation of concerns, testable, extensible
5. **Axios-like client**: Familiar DX, lower learning curve
6. **Middleware chain**: Standard pattern, composable, predictable execution order

## Performance Characteristics

| Operation          | Complexity | Optimization   |
| :----------------- | :--------- | :------------- |
| Route Match (Cold) | O(k)       | Trie Traversal |
| Route Match (Hot)  | O(1)       | LRU Cache      |
| Payload Validation | O(v)       | Schema Parsing |
| Param Extraction   | O(n)       | Compiled Regex |

- **Route Registration**: O(k) where k is number of segments
- **Route Matching**: O(k) where k is number of segments
- **Static Routes**: O(1) per segment (Map lookup)
- **Parametric Routes**: O(1) per segment (single paramChild)
- **Wildcard Routes**: O(1) (single wildcardChild)
- **Memory**: O(n\*m) where n is routes, m is average segments per route

## Usage Patterns

### Controller Definition

```typescript
router.get("users:[id:number]", async (ctx) => {
  return await db.users.find(ctx.params.id); // ctx.params.id is a number
});
```

### Schema Validation

```typescript
router.post("user:create", handler, {
  schema: zod.object({ name: zod.string() }),
});
```

## Known Issues (Resolved)

1. **Recursion Limits**: Fixed by implementing iterative stack-based matching.
2. **Type Coercion**: Fixed by implementing coerceParamValue for all supported types.
3. **Electron Memory** Leaks: Fixed by adding once('destroyed') listeners to WebContents.
4. **Regex Corruption**: Fixed by using proper escape sequences in pattern generation.

## Future Roadmap

1. **Circuit Breaker**: Implementation of state-based failure prevention in EventClient.
2. **Binary Support**: Optimization for Buffer/Uint8Array payloads in IPC.
3. **Wildcard Priorities**: Support for weighted matching when multiple wildcards conflict.

## Next Steps for Development

1. **WebSocket Adapter**: Real-time browser communication
2. **HTTP REST Adapter**: Standard HTTP API compatibility
3. **Testing Infrastructure**: Unit, integration, and performance tests
4. **Documentation**: API docs, guides, and tutorials
5. **Plugin System**: Enhance for common patterns (caching, logging, metrics)
6. **CLI Tools**: Route inspection, testing, code generation
7. **Performance Optimization**: Benchmark and optimize hot paths
8. **Error Handling**: Comprehensive error types and recovery strategies

## API Reference

### EventRouter

#### Methods

- `on(channel, handler, config?)` - Register event handler
- `get(channel, controller, config?)` - Register GET controller
- `post(channel, controller, config?)` - Register POST controller
- `put(channel, controller, config?)` - Register PUT controller
- `patch(channel, controller, config?)` - Register PATCH controller
- `delete(channel, controller, config?)` - Register DELETE controller
- `use(middleware)` - Add global middleware
- `guard(guard)` - Add global guard
- `merge(router, prefix?)` - Merge child router
- `emit(channel, event, metadata?)` - Emit event
- `execute(method, channel, event, metadata?)` - Execute controller
- `match(channel)` - Match channel to route
- `has(channel)` - Check if route exists
- `getRoutes()` - Get all registered routes

### EventClient

#### Client Methods

- `get(channel, config?)` - GET request
- `post(channel, data?, config?)` - POST request
- `put(channel, data?, config?)` - PUT request
- `patch(channel, data?, config?)` - PATCH request
- `delete(channel, config?)` - DELETE request
- `request(method, channel, data?, config?)` - Generic request
- `emit(channel, data?, config?)` - Fire-and-forget event
- `broadcast(channels, data?, config?)` - Emit to multiple channels
- `subscribe(channel, callback)` - Subscribe to channel
- `publish(channel, data)` - Publish to subscribers
- `unsubscribe(channel)` - Unsubscribe from channel
- `unsubscribeAll()` - Unsubscribe from all channels
- `use(plugin)` - Install plugin
- `create(config)` - Create scoped client

#### Interceptors

- `client.interceptors.request.use(interceptor)` - Add request interceptor
- `client.interceptors.response.use(interceptor)` - Add response interceptor
- `client.interceptors.error.use(interceptor)` - Add error interceptor

### BaseAdapter

#### Abstract Methods

- `request<T>(req: AdapterRequest): Promise<T>` - Execute request
- `subscribe(channel, callback): () => void` - Subscribe to channel
- `publish(channel, data): Promise<void>` - Publish to channel
- `initialize(): Promise<void>` - Initialize adapter
- `dispose(): Promise<void>` - Cleanup resources
- `isReady(): boolean` - Check adapter status

---

## Usage Instructions for LLM Continuation

When working with this codebase, you can:

1. **Add new adapters**: Extend `BaseAdapter` and implement all abstract methods
2. **Enhance routing**: Modify Trie structure or matching algorithm
3. **Add features to client**: Extend `EventClient` with new methods
4. **Create plugins**: Use plugin system to add cross-cutting concerns
5. **Improve type safety**: Add more specific type constraints
6. **Optimize performance**: Focus on hot paths in matching and execution

The complete implementation is in a single TypeScript artifact with clear sections for each component. All code follows enterprise patterns with full type safety and comprehensive error handling.

## Known Issues

1. **parseSegmentPattern corruption**: The regex replacement string was getting corrupted during updates. Fixed by using proper escape sequence `'\\$&'`.
2. **Electron webContents cleanup**: Need to handle destroyed webContents gracefully in main adapter.
3. **Type coercion**: Parameter types are currently strings in extracted params, may need runtime coercion for number/boolean types.

## Contributing Guidelines

When extending this codebase:

- Maintain O(k) performance characteristics
- Add comprehensive type definitions
- Include error handling for all async operations
- Write tests for new features
- Document public APIs
- Follow existing code style and patterns
- Ensure backward compatibility

## Recommended Enhancements

### 1. Implement Automatic Type Coercion (Fixing "Known Issue #3")

The spec explicitly lists "Type coercion" as a known issue. Currently, `extractParamsFromSegment` returns all parameters as strings, even if the route is defined as `[id:number]`.

**Optimization:** Modify `extractParamsFromSegment` to convert values based on the captured type.

```typescript
// Inside EventRouter class
private coerceParam(value: string, type?: ParamType): any {
  switch (type) {
    case 'number': return Number(value);
    case 'boolean': return value === 'true';
    case 'datetime': return new Date(value);
    default: return value;
  }
}

// In extractParamsFromSegment
for (let i = 0; i < pattern.params.length; i++) {
  const param = pattern.params[i];
  const rawValue = match[i + 1];
  // Apply coercion here
  params[param.name] = this.coerceParam(rawValue, param.type);
}

```

### 2. LRU Match Caching (Performance)

The current implementation performs a Trie traversal (`O(k)`) and Regex execution for _every_ event emitted. In high-throughput systems, the same channels (e.g., `user:profile:123`) are often hit repeatedly.

**Optimization:** implementations of an LRU (Least Recently Used) cache in the `EventRouter`.

- **Key:** The channel string (e.g., `"user:profile:123"`).
- **Value:** The resolved `RouteMatch` object.
- **Mechanism:** Before calling `matchSegments`, check the cache. If hit, return immediately (O(1)). If miss, traverse the Trie, store the result, and return.

### 3. Regex Instance Caching

In `parseSegmentPattern`, a new `RegExp` is created for every single node insertion. If you have 1,000 routes that all use `[id:uuid]`, you are compiling the exact same Regex 1,000 times.

**Optimization:** Create a static or shared `Map<string, RegExp>` to cache compiled regexes based on the pattern string. This significantly reduces memory footprint during route registration.

### 4. Runtime Payload Validation (Zod Integration)

While the router has TypeScript types, these vanish at runtime. An "enterprise-grade" system needs to ensure that if a client emits a `user:create` event, the payload actually matches the expected schema.

**Enhancement:** Allow passing a validator (like Zod or Joi) in the route config.

```typescript
// Updated RouteConfig
export interface RouteConfig<T = any> {
  schema?: ZodSchema<T>; // Add schema support
  handler: EventHandler<T>;
  // ...
}

// Inside executeMiddlewareChain or a built-in Guard
if (match.schema) {
  const result = match.schema.safeParse(ctx.event);
  if (!result.success) throw new Error("Validation Failed");
}
```

### 5. Circuit Breaker Pattern (Reliability)

The `EventClient` has timeouts, but the spec mentions "Circuit breaker pattern" as pending work. If an adapter (e.g., a specific microservice via HTTP) is failing consistently, the client should stop sending requests immediately to prevent cascading failures.

**Enhancement:** Wrap the `request` method in `EventClient` with a state machine:

1. **Closed (Normal):** Requests go through.
2. **Open (Tripped):** Fail immediately without calling the adapter.
3. **Half-Open:** Allow one test request through.

### 6. Electron specific: Robust "WebContents" Cleanup

The `ElectronIPCMainAdapter` attempts to clean up subscriptions using `wc.isDestroyed()`, but this is reactive.

**Optimization:** in the `initialize` method of `ElectronIPCMainAdapter`, listen specifically for the `destroyed` or `render-process-gone` events on the `webContents` to proactively clear the `subscriptions` Map. This prevents a memory leak where the Map holds ID references to dead processes until a publish event attempts to send data to them.

### 7. Flatten Recursive Matching

The `matchSegments` method uses recursion. While elegant, deep recursion in JavaScript can be slower than iteration due to stack frame allocation.

**Optimization:** Refactor `matchSegments` to use a `while` loop with a stack or pointer. Given the Trie depth is likely shallow (path segments), this is a micro-optimization, but for a high-performance router, iterative approaches are generally preferred in JS engines.

### 8. Add Request Tracing IDs

To make this truly "Enterprise," you need observability.

**Enhancement:**

1. In `EventClient`, generate a `traceId` (UUID) if one is not provided in `metadata`.
2. Pass this `traceId` through the adapter.
3. In `EventRouter`, ensure the `traceId` is available in the `EventContext`.
4. This allows you to correlate a log in the Renderer process with the resulting error in the Main process.
