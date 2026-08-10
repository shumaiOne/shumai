# Plan: MCP Support for Shumai (Backend)

> Status: **Plan finalized** — all design questions resolved (see §11, incl. review-round-2 decision D10). Ready to implement.
> This file is the single source of truth for the MCP backend plan. Update it whenever the plan changes.

## 1. Understanding of the current architecture

**Chat flow today** (`packages/core/src/chat/chat.ts` → `packages/agent/src/workflows/agent-chat.ts` → `packages/agent/src/activities/agent.ts`):
1. User sends chat → `chatService.startOrContinueChat` creates a `WorkflowTask` (type `chat`).
2. `agentChat` workflow → `agentChatActivity` → `executeAgentPrompt` → `createAgentSession(...)` (in `packages/agent/src/index.ts`).
3. `createAgentSession` builds `AgentTool[]` (TypeBox `parameters` + `execute(toolCallId, params)`), registers them on `AgentHarness`, and calls `harness.prompt()`. The harness validates args via `validateToolArguments` (pi-ai) which **works with plain JSON Schema objects** (falls back to `coerceWithJsonSchema` when the TypeBox `Kind` symbol is absent), and passes `tool.parameters` straight to provider APIs (`parametersJsonSchema` for Gemini / `parameters` for OpenAI).

**Key reference — `pi-mcp-adapter`** (idea reference only, at `/Users/yiling/Projects/pi-mcp-adapter` — do NOT modify; port patterns from it). Relevant files: `server-manager.ts`, `mcp-auth.ts`, `mcp-auth-flow.ts`, `mcp-oauth-provider.ts`, `mcp-callback-server.ts`, `proxy-modes.ts`, `direct-tools.ts`, `search-ranking.ts`, `tool-registrar.ts`, `types.ts`, `mcp-code.ts`.
- **Tool exposure has two modes**: (1) *default* — a single `mcp` proxy tool is registered with Pi (only one tool in the LLM context), which multiplexes **all servers** via a `server` parameter that disambiguates tool calls (`mcp({ tool, server, args, connect, search, describe, ... })`); (2) *opt-in* `directTools: true | string[]` — each MCP tool is registered directly as its own prefixed tool (e.g. `xcodebuild_list_sims`), with an advisory warning at ≥75 tools because each direct tool adds prompt context. Shumai's plan (D3) adopts **the same design** (proxy default + per-server opt-in `directTools`), with one simplification: shumai's `directTools` is **boolean-only** — tool selection is always via `includeTools`/`excludeTools` filters (Q6).
- `server-manager.ts`: `McpServerManager` wraps `Client` from `@modelcontextprotocol/client`, connects via `StdioClientTransport` / `StreamableHTTPClientTransport` / `SSEClientTransport`, discovers tools/resources/prompts, executes `client.callTool`.
- `mcp-oauth-provider.ts`: `McpOAuthProvider implements OAuthClientProvider` (the SDK interface) — `clientInformation`, `saveClientInformation`, `tokens`, `saveTokens`, `redirectToAuthorization`, `saveCodeVerifier`/`codeVerifier`, `saveDiscoveryState`/`discoveryState`, `saveState`/`state`, `invalidateCredentials`, `addClientAuthentication`, `prepareTokenRequest`.
- `mcp-auth.ts`: storage layer (OS keyring / plaintext files) — **this is the part we replace with DB storage**.
- `mcp-auth-flow.ts`: `startAuth`/`completeAuth`/`authenticate`/`getValidToken`/`getAuthStatus`/`removeAuth` using SDK `auth()` + local callback server.
- `proxy-modes.ts` `executeCall`: tool metadata lookup → `client.callTool({ name, arguments })` → transform MCP content blocks (`text`/`image`/`resource`/etc.) into model content blocks.

---

## 2. Design decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | MCP runtime lives in **`@shumai/core/src/mcp/`** (`McpService`, `McpServerManager`, DB-backed OAuth provider). | Both the API (CRUD/OAuth) and the agent worker (`@shumai/agent` activities) need it. `@shumai/agent` already depends on `@shumai/core`. Add `@modelcontextprotocol/client` dep to `@shumai/core` only. |
| D2 | **URL-based servers only** (Streamable HTTP with SSE fallback), no stdio. ✅ Confirmed (Q1). | "Add MCP server address in webui" = URL. Stdio spawns local processes — conflicts with "don't store/run anything on the local host machine" and complicates multi-worker/Temporal deployments. |
| D3 | **Single `mcp` proxy tool by default** (pi-mcp-adapter style): one `AgentTool` multiplexes all assigned MCP servers via params `{ server, tool, args, search, describe, connect, action... }` (listing via `server` without `tool`; auth via `action: 'status' | 'auth-start'`), keeping the LLM context small. **Per-server opt-in `directTools: boolean`** registers that server's tools directly as prefixed `AgentTool`s (e.g. `xcodebuild_list_sims`); which tools become direct is always controlled by `includeTools`/`excludeTools` filters — **no `string[]` form** (Q6). | Mirrors pi-mcp-adapter's proven model (confirmed by user preference): 1 tool in context by default; direct tools only for servers an agent's team explicitly opts in. |
| D4 | All OAuth/token state stored in **DB** (`McpServerCredential` 1:1 row), replacing pi-mcp-adapter's keyring/files. Tool metadata cached in DB too. | Explicit requirement. No host-machine state. |
| D5 | OAuth redirect/callback served by **shumai's own Hono API** (`/api/mcp/oauth/callback`) instead of a local callback server. ✅ Confirmed (Q4): `redirectUri` defaults to `${BETTER_AUTH_URL}/api/mcp/oauth/callback`, overridable via `MCP_OAUTH_REDIRECT_BASE_URL`. | Shumai is a hosted web app; the browser must reach the callback. |
| D6 | MCP servers are **team-scoped records**, but assignment to agents is **per-agent** via an `AgentMcpServer` join table (mirrors `AgentSkill`/skills). An agent gets tools only from its **assigned + enabled** servers. ✅ Confirmed (Q2). | Per-agent control, consistent with how skills are attached to agents today. |
| D7 | Connection lifecycle: **lazy per-process connection** in the worker/web process, single-flight per server, auto-reconnect on failure, non-fatal to chat if a server is down (tool returns error text; other tools still work). | MCP connections are in-memory resources on a worker process; DB holds config + credentials so any process can reconnect. |
| D8 | Secrets (tokens, bearer token, clientSecret) stored in DB **as-is** (same pattern as existing `Provider.config.apiKey`). Encryption-at-rest is a follow-up. ✅ Confirmed (Q3). | Consistent with existing codebase behavior. |
| D9 | **Auth types (Q5)**: `none`, `bearer`, and OAuth `authorization_code` (dynamic registration + pre-registered `clientId`) **and** `client_credentials` — all supported in v1. | Covers public MCP servers, static-token servers, and full OAuth 2.1 servers. |
| D10 | **Per-server usage permission** (review round 2): `McpServer.permission TeamMemberRole @default(reviewer)` mirrors `Skill.permission`; enforced at tool-execution time in `callMcpTool` with the same `ROLE_HIERARCHY` gate as `read-skill.ts` (no user context + permission > reviewer → denied). | User decision: "add permission similar to skill". Proxy `search`/`describe`/`status` stay available so the two-phase discovery model works; the gate protects actual tool execution (the analog of reading a skill's content). |

---

## 3. Database schema (`packages/db/prisma/schema.prisma`)

New models (all `id @default(ulid())`, snake_case maps, cascade on team delete):

```prisma
model McpServer {
  id            String   @id @default(ulid())
  name          String                       // unique per team; connection key + tool prefix
  url           String                       // Streamable HTTP / SSE endpoint
  transport     McpTransport @default(streamable_http) // streamable_http | sse (auto fallback when 'streamable_http' + server doesn't support it)
  /// [McpServerAuthConfig]
  authConfig    Json?    @default("{}")      // { type: 'none'|'bearer'|'oauth', bearerToken?, headers?, oauth?: { clientId?, clientSecret?, scope?, grantType?, authorizationParams?, redirectUri?, clientName?, clientUri?, skipIssuerMetadataValidation? } }
  /// [McpServerConfig]
  config        Json?    @default("{}")      // { includeTools?, excludeTools?, requestTimeoutMs?, protocolVersion?, directTools?: boolean }  // directTools is boolean-only (Q6); toolPrefix removed (Q12 — naming is always {server}_{tool})
  enabled       Boolean  @default(true)
  permission    TeamMemberRole @default(reviewer) // mirrors Skill.permission; gate for tool execution (D10)
  /// [McpToolInfo[]]
  tools         Json?    @default("[]")      // cached discovered tool list (name/description/inputSchema)
  status        String   @default("not_connected") // not_connected|connected|failed|needs_auth
  lastError     String?
  lastConnectedAt DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  teamId        String   @map("team_id")
  team          Team     @relation("TeamToMcpServer", fields: [teamId], references: [id], onDelete: Cascade)
  credential    McpServerCredential?
  agentMcpServers AgentMcpServer[]

  @@unique([teamId, name])
  @@map("mcp_servers")
}

// Join table: which agents get which MCP servers (mirrors AgentSkill).
model AgentMcpServer {
  id          String    @id @default(ulid())
  agentId     String    @map("agent_id")
  agent       Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  mcpServerId String    @map("mcp_server_id")
  mcpServer   McpServer @relation(fields: [mcpServerId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@unique([agentId, mcpServerId])
  @@map("agent_mcp_servers")
}

model McpServerCredential {
  id          String   @id @default(ulid())
  serverId    String   @unique @map("server_id")
  server      McpServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
  serverUrl   String                       // bind creds to the URL they were issued for
  /// [McpStoredTokens]
  tokens      Json?
  /// [McpStoredClientInfo]
  clientInfo  Json?
  codeVerifier String?
  oauthState  String?
  /// [McpPendingAuth]
  pendingAuth Json?                        // in-flight authorization_code flow (state, discovery snapshot, authorizationUrl, expiresAt)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@map("mcp_server_credentials")
}
```

- Add `mcpServers McpServer[] @relation("TeamToMcpServer")` on `Team` (inside the relation block), `mcpServers AgentMcpServer[]` on `Agent`, and `agentMcpServers AgentMcpServer[]` on `McpServer`. Mirror the exact `AgentSkill` block style (see `packages/db/prisma/schema.prisma` ~line 761).

- New JSON types in `packages/db/src/prisma-json-types.ts`: `McpServerAuthConfig`, `McpServerConfig`, `McpToolInfo`, `McpStoredTokens`, `McpStoredClientInfo`, `McpPendingAuth` (mirroring pi-mcp-adapter `mcp-auth.ts` shapes).
- **Note**: `Agent.id` is **not** refactored — it keeps doubling as the agent's `User.id` today. `AgentMcpServer.agentId` simply references the existing `Agent.id`.
- Migration via `bun --bun run prisma migrate dev` (never hand-write DDL).

---

## 4. DTOs (`packages/dtos/src/mcp.ts` + `agent.ts` + export in `index.ts`)

Zod schemas + types in `mcp.ts`:
- `McpServerAuthType = 'none' | 'bearer' | 'oauth'`
- `CreateMcpServerRequest` (`name`, `url`, `transport?`, `authConfig?`, `config?`, `enabled?`, `permission?`)
- `UpdateMcpServerRequest` (partial, plus optional `refreshTools` flag)
- `UpdateMcpServerPermissionRequest` (`permission: 'owner' | 'editor' | 'reviewer'`) for the dedicated `PATCH /mcp/servers/:id/permission` (mirrors `updateSkillPermissionRequestSchema`)
- `McpServerInfo` (id, name, url, transport, authType, enabled, permission, status, lastError, toolCount, hasCredential, createdAt/updatedAt) — **never returns tokens/secrets**
- `McpToolInfo` (name, description, inputSchema, title?)
- `ListMcpServersResponse` (`{ servers: McpServerInfo[] }`)
- `RefreshToolsRequest/Response`
- OAuth: `McpAuthStatus` (`'authenticated' | 'expired' | 'not_authenticated' | 'in_progress'`), `McpAuthStartResponse` (`{ authorizationUrl, status }`), `McpAuthCompleteRequest` (`{ code, iss? }`), `McpAuthStatusResponse`

Changes in `agent.ts` (per-agent assignment, Q2): add `mcpServerIds?: string[]` to `CreateAgentParams`/`UpdateAgentParams` (mirrors `skills`); `AgentInfo`/list responses include `mcpServers`/`mcpServerIds`.

---

## 5. Core MCP runtime (`packages/core/src/mcp/`)

### 5a. `mcp-db-store.ts` — DB-backed credential store
Ports pi-mcp-adapter `mcp-auth.ts` API (`getAuthForUrl`, `saveAuthEntry`, `updateTokens`, `updateClientInfo`, `updateCodeVerifier`, `updateOAuthState`, `getOAuthState`, `clearOAuthState`, `clearAllCredentials`, `clearClientInfo`, `clearTokens`, `isTokenExpired`, `hasStoredTokens`) but reads/writes `McpServerCredential` via Prisma. Also stores `pendingAuth` (the in-flight authorization_code flow) with a TTL.

### 5b. `mcp-oauth-provider.ts` — `OAuthClientProvider` implementation
Adapted from pi-mcp-adapter `mcp-oauth-provider.ts`:
- Same interface methods; storage calls go to the DB store instead of keyring/files.
- `redirectUrl` = configured `redirectUri` or `${MCP_OAUTH_REDIRECT_BASE_URL}/api/mcp/oauth/callback`.
- Flow state (PKCE verifier, discovery state, authorization URL, `state`) persisted to `pendingAuth` in DB so the flow survives across HTTP requests (start → browser → callback).

### 5c. `mcp-server-manager.ts` — connection lifecycle
Simplified port of pi-mcp-adapter `server-manager.ts`:
- `connect(serverId, config, creds)` — creates `Client` + `StreamableHTTPClientTransport` (fallback to SSE on 404/405/406/415) or pinned `SSEClientTransport`; passes `authProvider` (the OAuth provider above) or static bearer header; `client.connect()`.
- Handles `UnauthorizedError`/401 → status `needs_auth`.
- `listTools` (paginated), `callTool(name, args)`, `close(name)`, `closeAll()`, single-flight connect dedup, per-server status tracking.
- Uses `versionNegotiation` from `@modelcontextprotocol/client` (default auto/legacy per config).

### 5d. `mcp-tool-schema.ts` — JSON Schema → AgentTool `parameters`
- Normalize MCP `inputSchema`: ensure `type: 'object'`; strip unsupported keywords (`$schema`, `additionalProperties` handling); pass through as `TSchema` (the harness accepts plain JSON Schema via pi-ai's coercion path, and providers get valid JSON Schema).
- Validate compile-ability with `typebox/compile` `Compile`; on failure fall back to `Type.Record(Type.String(), Type.Unknown())` so the tool still works (args passed through to `callTool`).
- Unit-tested against tricky schemas (`$defs`/`$ref`, `anyOf`, enums, `additionalProperties`, `patternProperties`).

### 5e. `mcp-tool-registry.ts` — in-memory tool metadata + search
- Per-process registry of discovered tools keyed by server: `{ serverId, serverName, name (prefixed), originalName, description, inputSchema }` (mirrors pi-mcp-adapter `ToolMetadata`). Loaded lazily from the DB cache (`McpServer.tools`) and refreshed on `connect`/`tools/refresh`.
- `listTools(serverId)` (or all), `findTool(name, serverId?)` (used by proxy call resolution + `describe`), `rankSuggestions(name, limit)` for "did you mean" errors.
- `searchTools(query, serverId?, limit?, offset?)` — port of pi-mcp-adapter `search-ranking.ts` (`normalizeSearchText` camelCase/snake-case splitting, weighted fields name>originalName>server>description, token/prefix/stem scoring, coverage gate, pagination).

### 5f. `mcp-proxy-tool.ts` — the single `mcp` proxy `AgentTool`
- Built per team/session by `buildProxyTool(teamId, userId?)`. The `parameters` schema mirrors pi-mcp-adapter's proxy tool: `{ tool?, args? (object|JSON string), server?, connect?, describe?, search?, includeSchemas?, limit?, offset?, action? (status|auth-start) }`.
- **Dynamic description** (ported from `buildProxyDescription`): server list + tool counts (`Servers: xcodebuild (12 tools), github (28)`), truncated server `instructions`, and usage examples. Rebuilt when metadata changes (per session; diffed to preserve prompt cache where possible).
- `execute` dispatches by mode precedence (`action > tool(call) > connect > describe > search > server(list) > status`):
  - `search` → `mcp-tool-registry.searchTools` → ranked results with name/description/parameter shape (`renderTsShape`-style TS shape or indented JSON Schema).
  - `describe` → full input schema for one tool.
  - `server` (no tool) → full tool list of that server.
  - `tool + server` (or auto-disambiguated) → `callMcpTool`; errors include suggestions + auth/server status hints.
  - `connect` → lazy connect + metadata refresh; `action` → `status` / `auth-start` only (no `auth-complete` — the API callback completes OAuth server-side, so the model never has a redirect URL to paste; it polls `status` instead).

### 5g. direct tools — per-server opt-in
- `resolveDirectTools(config)`: when `config.directTools === true`, that server's allowed tools (after `includeTools`/`excludeTools`) become direct `AgentTool`s. **`directTools` is boolean-only** (Q6) — tool selection is always via the include/exclude filters, never a `string[]`.
- Prefixed names via `formatToolName` (pi-mcp-adapter "server" prefix mode: `{serverName}_{toolName}`; dots sanitized to `_`) (Q7); `parameters` from `mcp-tool-schema.ts`; `execute` → same `callMcpTool` path as the proxy.
- These tools are registered alongside the `mcp` proxy tool (the proxy stays for discovery/auth/status and for servers not in direct mode).

### 5h. `mcp-service.ts` — `McpService` (singleton, per AGENTS.md patterns)
- **CRUD**: `createServer`, `updateServer` (on **URL/auth/name** change → clear cached tools + credentials + close connection; renaming changes the direct-tool prefix, so it must invalidate exactly like a URL change), `deleteServer` (cascade), `listServers`, `getServer`.
- **Discovery**: `discoverTools(serverId)` — connect (or read cached), `listTools`, persist to `McpServer.tools`, update `status`/`lastError`/`lastConnectedAt`, refresh the in-process registry. Used by `refreshTools` API + lazy refresh on connect.
- **OAuth**:
  - `startAuth(serverId)` → `SDK auth()` flow: discovery + (dynamic) client registration → capture authorization URL via `redirectToAuthorization` → persist `pendingAuth` → return URL. (For `client_credentials`, exchange directly, store tokens.)
  - `completeAuth(serverId, { code, iss })` → validate pending flow (`state` checked at callback), run SDK `auth({ authorizationCode, iss, ... })` → tokens saved to DB → clear pendingAuth.
  - `handleOAuthCallback(code, state, iss)` — used by the API callback route (validates state, delegates to `completeAuth`).
  - `getAuthStatus(serverId)`, `removeAuth(serverId)`.
- **Agent integration**: `buildAgentTools(agentId, teamId, userId?): Promise<AgentTool[]>` — reads the agent's **assigned** MCP servers via the `AgentMcpServer` join (only `enabled` ones), returns `[mcpProxyTool, ...directToolsForAssignedOptedInServers]` (D3, D6). **If the agent has zero assigned enabled servers, return `[]` (no proxy tool registered — don't waste LLM context).** Proxy description lists the agent's assigned servers; direct tools registered only for opted-in servers. Lazy connection: first `execute` ensures connect; `needs_auth` → instructive error text; failures return error text + record `lastError` (non-fatal to chat).
- **`callMcpTool(serverId, toolName, args, ctx?: { teamId; userId? })`** — **permission gate first (D10)**: resolve the requesting user's team role and compare against `McpServer.permission` using the `ROLE_HIERARCHY` pattern from `packages/agent/src/tools/read-skill.ts`; return permission-denied error text if the role is insufficient or if there is no user context and permission > reviewer. Then ensure connection → `client.callTool({ name, arguments })` → transform content (text/image/resource → `TextContent`/`ImageContent`), fall back to `structuredContent` JSON when `content` is empty.
- In-memory manager cache per process (`Map<serverId, McpServerManager>`), with `serverId` as the key (server names are per-team, so id is unambiguous).

---

## 6. API layer (`packages/api/src/mcp.ts` + mount in `index.ts`)

```
# Public (no auth — OAuth provider redirects here)
GET/POST /api/mcp/oauth/callback   → validate state, completeAuth, return HTML page that
                                     postMessage()s result to the opener (webui tab) and closes

# Authenticated (authMiddleware + authz: Admin on Team for list/create; Admin on McpServer for id-scoped, matching skills)
GET    /teams/:teamId/mcp/servers
POST   /teams/:teamId/mcp/servers
PATCH  /mcp/servers/:id
PATCH  /mcp/servers/:id/permission        → set `permission` (mirror skill)
DELETE /mcp/servers/:id
GET    /mcp/servers/:id
POST   /mcp/servers/:id/tools/refresh        → discoverTools, returns McpToolInfo[]
GET    /mcp/servers/:id/tools
POST   /mcp/servers/:id/auth/start           → { authorizationUrl } | 200 (already authenticated)
POST   /mcp/servers/:id/auth/complete        → { code, iss? } → status
GET    /mcp/servers/:id/auth/status
DELETE /mcp/servers/:id/auth
POST   /mcp/servers/:id/test                 → optional: try connect + listTools (for UI validation)
```

- Route chaining on Hono + `zValidator` (per AGENTS.md). **Authz mirrors the skill API exactly**: list/create → `ResourceType.Team` + `Permission.Admin`; id-scoped routes (`PATCH/DELETE/GET /mcp/servers/:id`, tools, auth, test, permission) → new `ResourceType.McpServer` + `Permission.Admin`, with a `resolveContext` case added in `packages/core/src/authz/authz.ts` (look up `teamId` from the server record, like `ResourceType.Skill`).
- Audit logging via `auditLogService.logAction` with new `AuditAction` entries (`mcp_server_create/update/delete`).
- Responses always mask secrets.

---

## 7. Agent integration (`packages/agent`)

1. `getAgentChatContextActivity` (and the autofill variant) fetch the agent's **assigned** `McpServer` records (via `AgentMcpServer`, only `enabled`, + cached tools + `directTools` config) and add `mcpServers` to `AgentExecutionContext`. `agentService.createAgent/updateAgent` persist `mcpServerIds` (mirrors `skills`).
2. In `executeAgentPrompt`, after building `customTools` from `params.tools`, call `mcpService.buildAgentTools(agentId, teamId, userId)` and append → returns the single `mcp` proxy tool plus direct tools for opted-in assigned servers (D3/D6). (Autofill agents keep `disableTools` semantics; MCP tools only go to chat agents by default.)
3. The proxy tool description carries the agent's assigned server map + usage; the model discovers tools on demand via `search`/`describe`/`server` (pi-mcp-adapter two-phase model). Direct-tool servers appear as normal native tools.
4. `callMcpTool` handles "tool not found / needs auth / server down" with clear text + "did you mean" suggestions so the model can recover. A `needs_auth` result surfaces a hint (e.g. "Ask the admin to connect MCP server X in Settings → MCP").
5. **Permission enforcement (D10)**: the gate lives inside `callMcpTool` (shared by proxy + direct tools), so no per-agent config is needed. Proxy `search`/`describe`/`status` stay available to keep the two-phase discovery model working; executing a tool the requesting user's role doesn't allow returns permission-denied error text (same style as `read_skill`).

---

## 8. Environment config

- `MCP_OAUTH_REDIRECT_BASE_URL` (optional) — the OAuth redirect base. `redirectUri` defaults to `${MCP_OAUTH_REDIRECT_BASE_URL}/api/mcp/oauth/callback`, and `MCP_OAUTH_REDIRECT_BASE_URL` itself defaults to `BETTER_AUTH_URL`. Document in README / `.env` samples.

---

## 9. Testing strategy (AGENTS.md mandates)

1. **Core service tests** (`packages/core/src/mcp/*.test.ts`, `setupTestDbHooks`):
   - DB store: save/read/update/clear tokens, clientInfo, verifier, state; URL-change invalidation; pendingAuth TTL.
   - OAuth provider: mocked SDK `auth()` flow asserting tokens/clientInfo persisted and `tokens()` returns stored values (adapt pi-mcp-adapter's `mcp-oauth-provider.test.ts`).
   - Tool schema conversion unit tests.
   - Server CRUD + `discoverTools` against a **real in-process MCP test server**: implement a tiny MCP server in the test using `@modelcontextprotocol/core` `Server` + `StreamableHTTP` on an ephemeral port (add `@modelcontextprotocol/core` as a devDependency); assert tools listed, `callMcpTool` round-trip, bearer auth header received, and 401 → `needs_auth`.
   - Proxy tool tests: search ranking (`searchTools` scoring/coverage gate, camelCase/snake-case queries), `describe`/`list` output, call resolution with `server` disambiguation across two servers exposing same-named tools, error suggestions.
   - Direct tools tests: `directTools: true` (boolean) + `includeTools`/`excludeTools` selection, prefixed naming (`{server}_{tool}`), and that direct tools + proxy coexist.
   - Per-agent assignment tests (`AgentMcpServer` join): agent with no assignment → `buildAgentTools` returns `[]`; agent with assignment gets that server's tools; disabled servers excluded.
- Permission gating tests (D10): server with `permission: 'editor'` → chat as reviewer returns permission-denied text; editor/owner succeeds; no user context + permission > reviewer denied (mirror `read-skill.ts`).
- Rename invalidation test: renaming a server clears cached tools + credentials + closes the connection (direct-tool prefix changes).
   - `buildAgentTools(agentId, ...)`: returns `[mcpProxyTool]` by default and adds direct tools only for assigned opted-in servers.
2. **API tests** (`packages/api/src/mcp.test.ts`): mock `mcpService` (`vi.mock`), verify routes, authz, input validation, audit logging, and that the callback route validates state.
3. **Workflow E2E** (`packages/e2e/workflow/mcp.test.ts`, both local + temporal executors): start the in-process MCP test server, seed team + McpServer, run `agent_chat` task with `AgentHarness.prototype.prompt` mocked to return a tool call to the `mcp` proxy tool (and a second case exercising direct-tools mode), and assert the workflow output reflects the MCP result (mock only AI calls — real MCP server, real DB, real S3). This exercises the full path `createAgentSession → mcpService.buildAgentTools → proxy/direct tool execute → callMcpTool → MCP server`.

---

## 10. Out of scope (this task)

- WebUI frontend (noted API contract is ready; `mcp.ts` DTOs + routes are the surface).
- Encrypting secrets at rest (plaintext-in-DB confirmed, Q3; encryption is a follow-up).
- stdio/command-based MCP servers (confirmed out of scope, Q1), resources/prompts exposure (tools only in v1).

---

## 11. Decisions & resolved questions

All open questions are now **resolved**:

| # | Question | Decision |
|---|----------|----------|
| Q1 | Transport scope | ✅ **URL-only** (Streamable HTTP + SSE fallback), no stdio → D2 |
| Q2 | Tool exposure | ✅ Single `mcp` proxy tool by default + per-server opt-in `directTools` (boolean) → D3 |
| Q3 | Scoping | ✅ **Per-agent** assignment via `AgentMcpServer` join (mirrors skills) → D6 |
| Q4 | Secrets storage | ✅ Plaintext in DB (consistent with `Provider.config.apiKey`); encryption-at-rest is a follow-up → D8 |
| Q5 | Callback URL base | ✅ `redirectUri` defaults to `${BETTER_AUTH_URL}/api/mcp/oauth/callback`, `MCP_OAUTH_REDIRECT_BASE_URL` override → D5 |
| Q6 | Auth types | ✅ All: `none`, `bearer`, OAuth `authorization_code` (dynamic registration + pre-registered clientId) + `client_credentials` → D9 |
| Q7 | Per-tool filters | ✅ Keep `includeTools`/`excludeTools`; `directTools` is **boolean-only** (no `string[]`) → D3/D6 |
| Q8 | Direct-tool naming | ✅ pi-mcp-adapter naming: proxy tool named `mcp`; direct tools `{server}_{tool}` ("server" prefix mode) → D3/D7 |
| Q9 | Proxy `auth-complete` action | ✅ **Dropped** — OAuth completes server-side via the API callback; proxy `action` is only `status`/`auth-start`; the model polls `status` → §5f |
| Q10 | Usage permission | ✅ `McpServer.permission` mirrors `Skill.permission`, enforced in `callMcpTool` → D10 |
| Q11 | Authz on id-scoped routes | ✅ Follow skill: add `ResourceType.McpServer` + `resolveContext` case → §6 |
| Q12 | `config.toolPrefix` | ✅ **Removed** (redundant — naming always `{server}_{tool}`) → §3 |
| Q13 | Rename handling | ✅ Rename clears cached tools + credentials + closes connection → §5h |

**Remaining (implementation-level, no user decision needed):** none. Ready to implement.

---

## 12. Implementation order & definition of done

Suggested order (each step keeps `bun run test` green where applicable):

1. **DB**: add `McpServer` (incl. `permission TeamMemberRole @default(reviewer)`)/`AgentMcpServer`/`McpServerCredential` models + `Team`/`Agent` relations to `packages/db/prisma/schema.prisma`; add `McpServerAuthConfig`, `McpServerConfig`, `McpToolInfo`, `McpStoredTokens`, `McpStoredClientInfo`, `McpPendingAuth` to `packages/db/src/prisma-json-types.ts` (global `PrismaJson` namespace); generate client (`bun --bun run prisma generate`) + migration (`bun --bun run prisma migrate dev --name add_mcp_servers`; never hand-write DDL).
2. **DTOs**: `packages/dtos/src/mcp.ts` (schemas per §4, `zod`), export from `packages/dtos/src/index.ts`; add `mcpServerIds?` to `packages/dtos/src/agent.ts` `CreateAgentParams`/`UpdateAgentParams` + responses.
3. **Core**: `packages/core/src/mcp/` files 5a→5h in dependency order (db-store → oauth-provider → server-manager → tool-schema → tool-registry → proxy-tool → direct-tools → service). Add `@modelcontextprotocol/client` to `packages/core/package.json` via `bun add @modelcontextprotocol/client --filter @shumai/core`.
4. **Agent service**: persist `mcpServerIds` in `packages/core/src/agent/agent.ts` `createAgent`/`updateAgent` (mirror `skills` handling, including the `deleteMany` + `createMany` pattern for the join table).
5. **API**: `packages/api/src/mcp.ts` (routes per §6, Hono chaining + `zValidator`), mount in `packages/api/src/index.ts` (**public OAuth callback route must be mounted before `authMiddleware`**, alongside `authnRoute`/`publicInviteRoute`), add `AuditAction` entries, add `ResourceType.McpServer` to `authz.ts` `resolveContext`, mask secrets in responses.
6. **Agent integration**: `AgentExecutionContext` gains `mcpServers` in `packages/agent/src/activities/agent.ts` (fetch via join); `executeAgentPrompt` calls `mcpService.buildAgentTools(agentId, teamId, userId)` and appends to customTools (`packages/agent/src/index.ts` `createAgentSession` call site); permission gate lands inside `callMcpTool` (D10).
7. **Tests**: core unit tests (incl. permission gating, rename-invalidation, tool-schema conversion) + in-process MCP test server (`@modelcontextprotocol/core` devDependency), API tests (`vi.mock` mcpService), workflow E2E (`packages/e2e/workflow/mcp.test.ts`, both proxy + direct modes, incl. a permission-denied case); update `apps/web/e2e/README.md` only if web specs change (they don't — webui out of scope).
8. **Verify**: run all checks, remove verification artifacts, commit, push branch, `gh pr create` (per AGENTS.md workflow).

**Key shumai files to read before/while implementing**: `packages/db/prisma/schema.prisma` (models `Team` ~236, `Skill` ~277, `Agent` ~737, `AgentSkill` ~761), `packages/db/src/prisma-json-types.ts`, `packages/core/src/agent/agent.ts` (skills handling), `packages/api/src/agent.ts` (agent routes), `packages/core/src/authz/authz.ts` (Permission/ResourceType), `packages/core/src/skill/skill.ts` (service pattern), `packages/api/src/skill.ts` (route pattern), `packages/api/src/index.ts` (route mounting + audit), `packages/agent/src/index.ts` (`createAgentSession` customTools ~337), `packages/agent/src/activities/agent.ts` (`executeAgentPrompt`, `getAgentChatContextActivity`), `packages/agent/src/tools/read-skill.ts` (permission gate pattern), `packages/agent/src/tools/create-folder.ts` (AgentTool shape), `packages/core/src/logger.ts` (pino), `packages/core/src/pagination.ts` (`paginateQuery`).

**Definition of done** (AGENTS.md submission rules): `bun run lint` + `bun run format` + `bun run typecheck` + `bun run test` + `bun run test:e2e:app` + `bun run test:e2e:webui` + `bun run test:e2e:workflow` all pass **simultaneously** on one final code state; backend tests comprehensive (incl. the MCP in-process server round-trips and workflow E2E for both proxy and direct modes); no explicit `any`; no verification artifacts committed; Conventional Commits; PR per the AGENTS.md template.
