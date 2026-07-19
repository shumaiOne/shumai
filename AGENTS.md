# Developer Guide

We use a pull request–based workflow for all tasks.

## Workflow

Before starting any task, create and switch to a new feature branch:

```bash
git checkout -b <branch-name>
```

Complete the task on that branch.

After finishing the work and verifying that all checks pass:

1. Stage and commit your changes.
2. Push the branch to `origin`.
3. Open a pull request using the GitHub CLI.

```bash
git add .
git commit -m "<commit-message>"
git push origin <branch-name>
gh pr create --title "<pull-request-title>" --body "<pull-request-body>"
```

---

## Commit Messages

We follow the Conventional Commits specification.

Commit messages MUST be formatted as:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Example:

```text
feat(auth): add OAuth login support
```

The commit contains the following structural elements, to communicate intent to the consumers of your library:

1. `fix:` a commit of the type `fix` patches a bug in your codebase.
2. `feat:` a commit of the type `feat` introduces a new feature to the codebase.
3. `BREAKING CHANGE:` a footer or `!` after the type/scope introduces a breaking API change.
4. Additional types are allowed (for example: `docs:`, `refactor:`, `test:`, `chore:`).

Write commit messages in the imperative mood and keep descriptions concise and specific.

Reference:
https://www.conventionalcommits.org/en/v1.0.0/#summary

---

## Pull Request Template

```md
## Summary

Briefly describe what this PR changes and why.

## Changes

- List the main updates made in this branch.
- Include any important implementation details.

## Verification

- Describe the checks or tests you ran.
- Include relevant outputs if applicable.

## Notes

Add any additional context, caveats, or follow-up work.
```

## Submission Rules

- **Strict Requirement**: A submission is considered complete **only** when there is a single final code state in which **all** of the following pass **simultaneously**:
  - `bun run lint`
  - `bun run format`
  - `bun run typecheck`
  - `bun run test`
  - `bun run test:e2e`
  - `bun run test:e2e:workflow`

- **Backend Testing Mandate**: Every backend feature, service method, workflow, and activity MUST be accompanied by comprehensive tests. Logic-heavy code without corresponding test coverage is considered incomplete.

- Fixes must be iterated until **no check causes any other check to fail**.

- **Type Safety**: The use of explicit `any` is strictly forbidden and will result in lint errors. You should use `unknown` instead when the type is not known. If you absolutely must use `any` due to a limitation (e.g. interacting with an untyped 3rd party library), you must add an eslint-disable comment (e.g., `// eslint-disable-next-line @typescript-eslint/no-explicit-any`) and include a comment directly above it clearly explaining _why_ we cannot be type-safe here.
- Do **not** submit intermediate states where some checks pass and others fail, even temporarily.

- **Cleanup Requirement**: Remove all verification related files (scripts, screenshots, `verification/` folder) before submit.

## Backend Architecture

The backend is built with:

- **Runtime**: Bun
- **Framework**: Hono
- **ORM**: Prisma (with Pgvector18)
- **Database**: Pgvector18

## Workspace Architecture

The project is a monorepo managed by **Bun Workspaces**. It follows a strictly decoupled architecture where each domain or layer is its own package:

- **WebUI (`packages/webui`)**: React-based frontend.
- **API (`packages/api`)**: Hono-based HTTP entry point. Handles requests and calls Core services.
- **Core (`packages/core`)**: Business logic, services, and infrastructure utilities.
- **Database (`packages/db`)**: Prisma client, schema, and migrations.
- **DTOs (`packages/dtos`)**: Shared type definitions and Zod schemas used by both API and WebUI.
- **Workers**: Specialized packages for background task execution:
  - `@shumai/workflow-core`: Common workflow engine logic.
  - `@shumai/agent`: AI agent workflows and activities.
  - `@shumai/transcode`: Media processing workflows and activities.

### Layered Communication Rules

1.  **API Layer** calls **Core Layer**. Do not access the database directly in the API layer.
2.  **Core Layer** calls **Database Layer** and other Core services.
3.  **DTO Layer** is imported by all layers to ensure end-to-end type safety.
4.  **No Direct DB Leak**: Do not return Prisma objects directly from the API; always map them to DTOs.

## Dependency Management

We follow Bun's monorepo conventions for dependency management:

1.  **Self-Contained Packages**: Every workspace package MUST declare its own runtime `dependencies` in its local `package.json`. Do not rely on dependencies being available via the root.
2.  **Shared DevDependencies**: Common development tools (e.g., `typescript`, `eslint`, `vitest`, `prettier`, `prisma`) MUST be declared in the root `package.json` to ensure version consistency across the workspace.
3.  **Local DevDependencies**: Tools specific to a single package (e.g., `@vitejs/plugin-react` for `webui`) should be declared in that package's local `package.json`.
4.  **Workspace Imports**: Use `workspace:*` for internal package dependencies.
5.  **Clean Root**: The root `package.json` must not contain runtime `dependencies`. It is reserved for shared `devDependencies` and workspace-wide `scripts`.
6.  **Adding Packages**: Never edit `package.json` manually to add new dependencies. Always use `bun add` (e.g., `bun add <package> --filter <workspace>`) from the root without specifying an explicit version, letting Bun resolve the correct version.

## TypeScript Configuration

We use a root-level `tsconfig.json` to manage path mappings for the entire workspace. This ensures that imports across packages resolve correctly during typechecking and in the IDE.

1.  **Path Mappings**: All workspace packages MUST have an entry in the `paths` object in the root `tsconfig.json`.
    ```json
    "paths": {
      "@shumai/core": ["packages/core/src/index.ts"],
      "@shumai/core/src/*": ["packages/core/src/*"]
    }
    ```
2.  **Package tsconfig**: Each package should have its own `tsconfig.json` that extends the root configuration and defines its specific `include`/`exclude` rules.
3.  **Cross-Package Resolution**: When adding a new package, you MUST update the root `tsconfig.json` path mappings to ensure it can be imported by other packages.

### Service Layer Patterns

- **Instance Methods**: Define service logic as instance methods on a class, not static methods.
- **Singleton Export**: Export a singleton instance of the service class.
  ```typescript
  export class MyService {
    async doSomething() { ... }
  }
  export const myService = new MyService()
  ```
- **Usage**: Import and use the exported instance.
  ```typescript
  import { myService } from '@shumai/core/src/services/myService'
  await myService.doSomething()
  ```

### Hono API Definitions

- **Route Chaining**: Always define API routes using method chaining on a Hono instance. This ensures that the type definitions for inputs and outputs are correctly inferred and preserved in the exported type.
- **Export Pattern**: Export the chained route instance as the default export.
  ```typescript
  const app = new Hono()
  const route = app
    .get('/', ...)
    .post('/', ...)
  export default route
  ```
- **Type Safety**: Use `zValidator` for request validation (query, json, form) to ensure full end-to-end type safety with the Hono RPC client.

## Frontend Architecture

The frontend is built with:

- **Runtime**: Bun (Bundler & Runner)
- **Framework**: React
- **Styling**: Tailwind CSS + Shadcn UI (Components)

### UI Rules

- **Prefer System Colors**: Always prefer using semantic system color design tokens (e.g., `bg-background`, `text-foreground`, `text-sidebar-primary`, `text-muted-foreground`, etc.) over hardcoded color utilities (e.g., `bg-blue-50`, `text-emerald-600`, `bg-emerald-500`). This ensures seamless compatibility with light and dark themes.

### Route Code-Splitting

To optimize initial bundle size, all routes must be code-split into `[route].tsx` (lightweight route definition and loaders) and `[route].lazy.tsx` (UI component and heavy imports).

### Development

- **Run Dev**: `bun run dev` (Runs on port 3000)


## Testing

We use **Vitest** for testing (via `bun run test`). **Do not use `bun test`** as it uses Bun's native test runner which is not compatible with this project's test suite.

### Bug Fixes

- **Mandatory Reproduction**: When fixing a backend bug, you MUST first write a test case that reproduces the bug (demonstrates the failure) before applying the fix. This ensures the bug is truly understood and prevents future regressions.

### Test Maintenance Rule

- **Do not delete tests** unless the feature or code being tested is permanently removed from the codebase.
- When refactoring code, you must also refactor the corresponding tests to ensure they pass with the new implementation.
- This ensures we maintain regression coverage and do not silently break features.

### Service Tests

- Located in `packages/core/src/**/*.test.ts`.
- For comprehensive testing against a real database instance, we use `Testcontainers` alongside a `PrismaTestingHelper` which wraps each test within an automatic PostgreSQL transaction rollback boundary.
- All service tests must use `setupTestDbHooks()` from `@shumai/db` to initialize the database boundaries for each test suite inside the `describe` block. This automatically registers `beforeEach` and `afterEach` hooks to manage transaction state.
- Import `prisma` from `@shumai/db` directly to interact with the database in tests. The testing helper automatically proxies it.

```typescript
import { describe, it, expect } from 'vitest'
import { prisma, setupTestDbHooks } from '@shumai/db'
import { teamService } from '@shumai/core/src/team/team'

describe('TeamService', () => {
  setupTestDbHooks()

  it('works with db', async () => {
    const user = await prisma.user.create({
      data: { name: 'Test User', password: 'pw' },
    })
    const team = await teamService.ensureDefaultTeam()
    expect(team).toBeDefined()
    expect(team.name).toBe('Default Team')
  })
})
```

The `bunfig.toml` is configured to run `setup-tests.ts` automatically as a preload step. This initializes the `Testcontainers` PostgreSQL instance and applies migrations before the tests begin running.

### API Tests

- Located in `packages/api/src/**/*.test.ts`.
- Mock the Service layer using `vi.spyOn(service, 'method')` or `vi.mock('@shumai/core/src/team/team')`.
- Verify that the API calls the Service methods correctly.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { teamService } from '@shumai/core/src/team/team'
import app from './team'

describe('Team API', () => {
  it('calls service', async () => {
    const mockEnsureDefaultTeam = vi
      .spyOn(teamService, 'ensureDefaultTeam')
      .mockResolvedValue({ id: '1', name: 'Default Team' } as any)

    // ... test logic ...

    expect(mockEnsureDefaultTeam).toHaveBeenCalled()
    mockEnsureDefaultTeam.mockRestore()
  })
})
```

### Workflow E2E Tests

- Located in `packages/e2e/workflow/**/*.test.ts`.
- Run via `bun run test:e2e:workflow` (which executes tests against both `local` and `temporal` executors dynamically).
- **Mandatory test coverage**: When creating or updating workflows or activities, you MUST create or update the corresponding E2E tests.
- **Mocking**: Mock ONLY AI API calls. Do not mock S3, databases, or media/transcode extraction services.
- Mock the AI response by spying on `AgentHarness.prototype.prompt`:

## Prisma Configuration & Migrations

- Schema: `packages/db/prisma/schema.prisma`
- Generated Client: `packages/db/src/generated/prisma`
- Config: `prisma.config.ts` (Required for Prisma 7+)

### Strict JSON Typing

We use `prisma-json-types-generator` to enforce strict type-safety for Prisma `Json` columns, rather than typing them as generic `JsonValue`.

- **Defining Types**: In `packages/db/prisma/schema.prisma`, annotate the JSON column with a triple-slash comment specifying the type name from `packages/db/src/prisma-json-types.ts`:
  ```prisma
  model WorkflowTask {
    /// [WorkflowTaskPayload]
    payload Json?
  }
  ```
- **Declaring Types**: All typed JSON shapes must be defined in `packages/db/src/prisma-json-types.ts` under the global `PrismaJson` namespace:
  ```typescript
  declare global {
    namespace PrismaJson {
      export type WorkflowTaskPayload = Record<string, unknown> | TaskSpec | AiTaskPayload
    }
  }
  ```
- **Usage**: When accessing these columns on the Prisma client (e.g. `task.payload`), the field will automatically be typed as the declared shape (e.g., `PrismaJson.WorkflowTaskPayload | null`).
- **Accessing Properties**: When working with union types or custom structures in the JSON payload, use proper narrowing or type guards instead of casting to `any`. Direct `as any` casting should be avoided.

### Migration Workflow

- Development: Use `bun --bun run prisma migrate dev` to create and apply migrations during development.
- Production: Use `bun --bun run prisma migrate deploy` to apply pending migrations in production environments.
- **No Manual Migration Creation**: Never create migration SQL files or directories manually by hand. Always use Prisma CLI commands (e.g. `bun --bun run prisma migrate dev --create-only` to generate a migration template, or `bun --bun run prisma migrate dev`) so Prisma correctly tracks migration metadata and checksums.
- **No Automatic Dev DB Reset**: Do not run `prisma migrate reset --force` or commands that force-reset the database automatically. If migrations become out of sync or a reset is required, stop executing, report the situation to the user, and present suggested manual cleanup/reset steps for the user to execute.

### Commands

- Generate Client: `bun --bun run prisma generate`
- Apply Migrations (Dev): `bun --bun run prisma migrate dev`
- Deploy Migrations (Prod): `bun --bun run prisma migrate deploy`

## ID Generation & Sorting

- **ULID Default**: All models (except key-value stores like `Setting`) must use `@default(ulid())` for the `id` field in `schema.prisma`.

```prisma
model Example {
 id String @id @default(ulid())
}
```

- **No Manual Assignment**: Do not manually generate or assign ULIDs in application code (e.g., `packages/core/src/*.ts`) for creating database records. Let Prisma handle it via the schema default.
  - Exception: File names generated by `FileService` may still use `ulid()` internally, but this is separate from the database ID.
- **Sorting**: All list APIs must order results by `id` descending (`orderBy: { id: 'desc' }`) to ensure consistent, time-based sorting (since ULIDs are sortable). Do not sort by `createdAt` as it is not indexed.

## Infinite Scroll & Pagination

- **Frontend**: For paginated APIs (which contain `pageInfo` and `total` fields), the UI MUST use an auto infinite scroll style design using `useInfiniteQuery` from `@tanstack/react-query` and `react-intersection-observer`. Use the `total` count from the API response instead of counting the results locally.
  - The default `limit` should be **20**.
- **Backend**:
  - Most list APIs support cursor pagination using opaque tokens (via `hyrumtoken` logic) using the `paginateQuery` helper function.
  - Pass `PaginationParams` containing `first` (limit) and `after` (cursor).
  - The default `limit` should be **20**.
  - Always use the `paginateQuery` helper function from `packages/core/src/pagination.ts` for consistent cursor pagination.

## Temporal Workflow & Activities

We use a custom workflow engine that supports both **Local** (polling-based) and **Temporal** (production-grade) execution.

### Architecture

1.  **Workflows**: Orchestrate multiple activities. They must be deterministic and compatible with Temporal's V8 isolate. Defined in worker packages (e.g., `@shumai/agent/src/workflows`, `@shumai/transcode/src/workflows`).
2.  **Activities**: Perform the actual work (DB updates, API calls, media processing). Grouped by domain in worker packages (e.g., `@shumai/agent/src/activities`, `@shumai/transcode/src/activities`).
3.  **Executors**:
    - `LocalExecutor` (in `@shumai/workflow-core`): Polls the database for `pending` tasks and executes them directly.
    - `TemporalExecutor` (in `@shumai/workflow-core`): Submits tasks to a Temporal cluster.
4.  **Automatic Submission**: New `WorkflowTask` records are automatically submitted to the `WorkflowService` via a Prisma Client Extension defined in `@shumai/db`.

### Dynamic Registration

To avoid circular dependencies, workflows and activities are dynamically registered onto the `LocalExecutor` registry at bootstrap time via initializer functions (e.g., `initAgentWorkflows()`, `initTranscodeWorkflows()`).

### Non-Retryable Error Handling

To prevent Temporal from indefinitely retrying fatal, expected business validation failures (e.g., missing records, invalid configurations, missing parameters), **never throw standard `Error` objects from workflow or activity logic.** Instead, throw a non-retryable `ApplicationFailure`.

**Mandatory Requirement**: You **MUST** set `nonRetryable: true` in the options object passed to `ApplicationFailure.create`. Standard errors or `ApplicationFailure` objects without `nonRetryable: true` will cause Temporal to retry the activity or workflow indefinitely.

- **Workflow Boundary**: In workflows, import `ApplicationFailure` from `@temporalio/workflow`:
  ```typescript
  import { ApplicationFailure } from '@temporalio/workflow'
  throw ApplicationFailure.create({ message: 'agentId missing in payload', nonRetryable: true })
  ```
- **Activity Boundary**: In activities, import `ApplicationFailure` from `@temporalio/activity`:
  ```typescript
  import { ApplicationFailure } from '@temporalio/activity'
  throw ApplicationFailure.create({
    message: 'no autofill agent found for team',
    nonRetryable: true,
  })
  ```

### Temporal Workflow Patterns

- **Definition**: Define workflows as exported async functions.
  ```typescript
  export async function myWorkflow(task: WorkflowTask): Promise<void> {
    const { activityA, activityB } = getActivities()
    await activityA({ ... })
    await activityB({ ... })
  }
  ```
- **Environment Compatibility**: Always use `getActivities()` from `@shumai/workflow-core` to ensure the code works in both Local and Temporal environments.
- **Activity Access**: Activities should be accessed via `getActivities()` within a workflow. Do not call services directly inside a workflow function to maintain Temporal compatibility.
- **Queue Redirection**: Production Temporal workers use worker-specific unique queues for data locality (e.g., local disk access) and consistent state.
  - Every workflow MUST first call `getAgentWorkerQueueActivity` or `getTranscodeWorkerQueueActivity` via the shared domain queue (e.g., `TaskQueueAgent` or `TaskQueueTranscode`) to obtain the specific queue name for that worker instance.
  - ALL subsequent activities (including shared DB activities like updating task status) MUST be executed on that specific discovered queue.
  - The shared domain worker ONLY registers the queue discovery activities. All other activities (shared and domain-specific) are registered on the specific worker.

### Activity Patterns

- **Implementation**: Activities _can_ and _should_ call other services (e.g., `aiService`, `transcodeService`) or interact with the database directly. Database (Prisma) queries or updates are allowed in all activity types (e.g., agent or transcode) for simplicity.

## Import conventions

- When importing across workspace packages, always use absolute workspace imports (e.g. `import { prisma } from '@shumai/db'`, `import { teamService } from '@shumai/core/src/team/team'`).
- **DTO Naming**: Do not append the `Dto` suffix to types or interfaces (e.g. use `JoinRequest` instead of `JoinRequestDto`).

## Radix UI / Shadcn UI Patterns

- **Modal Overlays**: When triggering a dialog (e.g., `Dialog`, `AlertDialog`) from inside a `DropdownMenu`, you must set `modal={false}` on the `<DropdownMenu>` component. Failing to do so will cause the UI to freeze due to conflicting focus management between the two modal components.
- **Scrollable Content**: Always use the Shadcn `ScrollArea` component (`@/ui/components/ui/scroll-area`) for scrollable content containers to ensure consistent custom scrollbar UI across the application.

## Logging

We use **pino** for logging. Always use **structured logging** to ensure logs are easily searchable and machine-readable.

- **Import**: `import { logger } from '@shumai/core/src/logger'`
- **Usage**: Pass an object as the first argument containing the metadata, and a string as the second argument for the descriptive message.
  ```typescript
  logger.info({ userId: user.id, projectId }, 'Project deleted successfully')
  ```
- **Levels**: Use appropriate levels: `debug`, `info`, `warn`, `error`.

## Internationalization (i18n)

All user-facing text in the WebUI (`packages/webui`) MUST be internationalized using **Paraglide JS**. Hardcoded text in UI components is strictly forbidden.

### Message Definition

1. Define your English message strings in [packages/webui/messages/en.json](packages/webui/messages/en.json).
2. Define the corresponding Chinese translation strings in [packages/webui/messages/zh.json](packages/webui/messages/zh.json).
3. Keys should use `snake_case`.

Example (`en.json`):

```json
{
  "my_key": "My English Text"
}
```

### Compilation

When you add or update translation keys, you must compile them to regenerate the type-safe functions:

```bash
# Compile once (generates type-safe TS/JS functions on disk)
bun run i18n:compile

# Watch and recompile on change during development
bun run i18n:watch
```

### Usage in Components

Import the compiled message namespace `m` and call it as a function:

```typescript
import { m } from '@/ui/paraglide/messages.js'

export function MyComponent() {
  return (
    <div>
      <h1>{m.my_key()}</h1>
    </div>
  )
}
```

Always use the absolute workspace alias path `@/ui/paraglide/messages.js` (or `runtime.js` for runtime features) when importing Paraglide outputs.
