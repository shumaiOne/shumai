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

### Layered Architecture

We follow a strict layered architecture:

1.  **API Layer (`src/api`)**: Handles HTTP requests, validation, and calls Service layer. **Do not access DB directly.**, **Do not return prisma object directly in api, use dto to avoid leak**
2.  **DTO Layer (`src/dtos`)**: All dtos used in api, which also used by ui for type-safty.
3.  **Service Layer (`src/services`)**: Contains business logic and interacts with the Database via Prisma.
4.  **Data Layer (`src/db.ts`)**: Exports the Prisma Client instance.

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
  import { myService } from '../services/myService'
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

### Development

- **Run Dev**: `bun --hot src/index.ts` (Runs on port 3000)

## Testing

We use **Vitest** for testing (via `bun run test`). **Do not use `bun test`** as it uses Bun's native test runner which is not compatible with this project's test suite.

### Bug Fixes

- **Mandatory Reproduction**: When fixing a backend bug, you MUST first write a test case that reproduces the bug (demonstrates the failure) before applying the fix. This ensures the bug is truly understood and prevents future regressions.

### Test Maintenance Rule

- **Do not delete tests** unless the feature or code being tested is permanently removed from the codebase.
- When refactoring code, you must also refactor the corresponding tests to ensure they pass with the new implementation.
- This ensures we maintain regression coverage and do not silently break features.

### Service Tests

- Located in `src/services/*.test.ts`.
- For comprehensive testing against a real database instance, we use `Testcontainers` alongside a `PrismaTestingHelper` which wraps each test within an automatic PostgreSQL transaction rollback boundary.
- All service tests must use `setupTestDbHooks()` to initialize the database boundaries for each test suite inside the `describe` block. This automatically registers `beforeEach` and `afterEach` hooks to manage transaction state.
- Import `prisma` from `@/db` directly to interact with the database in tests. The testing helper automatically proxies it.

```typescript
import { describe, it, expect } from 'vitest'
import { prisma } from '@/db'
import { setupTestDbHooks } from '@/db-test-hooks'
import { teamService } from './team'

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

- Located in `src/api/*.test.ts`.
- Mock the Service layer using `vi.spyOn(service, 'method')` or `vi.mock('@/services/myService')`.
- Verify that the API calls the Service methods correctly.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { teamService } from '@/services/team/team'
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

## Prisma Configuration & Migrations

- Schema: `prisma/schema.prisma`
- Generated Client: `src/generated/prisma`
- Config: `prisma.config.ts` (Required for Prisma 7+)

### Strict JSON Typing

We use `prisma-json-types-generator` to enforce strict type-safety for Prisma `Json` columns, rather than typing them as generic `JsonValue`.

- **Defining Types**: In `prisma/schema.prisma`, annotate the JSON column with a triple-slash comment specifying the type name from `src/prisma-json-types.ts`:
  ```prisma
  model WorkflowTask {
    /// [WorkflowTaskPayload]
    payload Json?
  }
  ```
- **Declaring Types**: All typed JSON shapes must be defined in `src/prisma-json-types.ts` under the global `PrismaJson` namespace:
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

- **No Manual Assignment**: Do not manually generate or assign ULIDs in application code (e.g., `src/services/*.ts`) for creating database records. Let Prisma handle it via the schema default.
  - Exception: File names generated by `FileService` may still use `ulid()` internally, but this is separate from the database ID.
- **Sorting**: All list APIs must order results by `id` descending (`orderBy: { id: 'desc' }`) to ensure consistent, time-based sorting (since ULIDs are sortable). Do not sort by `createdAt` as it is not indexed.

## Infinite Scroll & Pagination

- **Frontend**: Use the `useInfiniteScroll` hook for all list UIs.
  - Located in `src/ui/hooks/use-infinite-scroll.ts`.
  - Pass a `fetchData` function that accepts `page` and `limit`.
- **Backend**:
  - Most list APIs support cursor pagination using opaque tokens (via `hyrumtoken` logic) using the `paginateQuery` helper function.
  - Pass `PaginationParams` containing `first` (limit) and `after` (cursor).
  - The default `limit` should be **20**.
  - Always use the `paginateQuery` helper function from `src/services/pagination.ts` for consistent cursor pagination.

## Temporal Workflow & Activities

We use a custom workflow engine that supports both **Local** (polling-based) and **Temporal** (production-grade) execution.

### Architecture

1.  **Workflows (`src/services/workflow/workflows`)**: Orchestrate multiple activities. They must be deterministic and compatible with Temporal's V8 isolate. Use `src/services/workflow/workflow-utils.ts` for environment-aware functions like `sleep` and `getActivities`.
2.  **Activities (`src/services/workflow/activities`)**: Perform the actual work (DB updates, API calls, media processing). Grouped by domain (e.g., `ai.ts`, `transcode.ts`).
3.  **Executors**:
    - `LocalExecutor`: Polls the database for `pending` tasks and executes them directly.
    - `TemporalExecutor`: Submits tasks to a Temporal cluster.
4.  **Automatic Submission**: New `WorkflowTask` records are automatically submitted to the `WorkflowService` via a Prisma Client Extension defined in `src/db.ts`.

### Non-Retryable Error Handling

To prevent Temporal from indefinitely retrying fatal, expected business validation failures (e.g., missing records, invalid configurations, missing parameters), **never throw standard `Error` objects from workflow or activity logic.** Instead, throw a non-retryable `ApplicationFailure`.

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
- **Registration**: All workflows must be exported from `src/services/workflow/workflows/index.ts` for Temporal worker registration.
- **Environment Compatibility**: Always use `getActivities()` from `workflow-utils.ts` to ensure the code works in both Local and Temporal environments.
- **Activity Access**: Activities should be accessed via `getActivities()` within a workflow. Do not call services directly inside a workflow function to maintain Temporal compatibility.

### Activity Patterns

- **Location**: Defined in `src/services/workflow/activities/<domain>.ts`.
- **Export**: Export individual activity functions and re-export them in `src/services/workflow/activities/index.ts`.
- **Implementation**: Activities _can_ and _should_ call other services (e.g., `aiService`, `transcodeService`) or interact with the database.
- **Database Access Restriction**: **Agent activities (or other non-database activities) are strictly prohibited from calling the database directly.** All database queries or updates must be isolated within dedicated database activities defined in `src/workflow/activities/db.ts` (running on `db_queue` / `TaskQueueDb`). Workflow functions coordinate execution by first invoking the database activity to resolve and store state, then passing the resolved data to the agent/non-database activity.

## Import conventions

- When importing across layers, always use absolute paths with the `@` alias for the root of the project (e.g. `import { AssetInfo } from '@/services/asset/models'`).
- For types that have been migrated from `@/ui/api/api`, use the equivalent types from the `src/services/<domain>/models.ts` instead.
- **DTO Naming**: Do not append the `Dto` suffix to types or interfaces (e.g. use `JoinRequest` instead of `JoinRequestDto`).

## Radix UI / Shadcn UI Patterns

- **Modal Overlays**: When triggering a dialog (e.g., `Dialog`, `AlertDialog`) from inside a `DropdownMenu`, you must set `modal={false}` on the `<DropdownMenu>` component. Failing to do so will cause the UI to freeze due to conflicting focus management between the two modal components.

## Logging

We use **pino** for logging. Always use **structured logging** to ensure logs are easily searchable and machine-readable.

- **Import**: `import { logger } from '@/logger'`
- **Usage**: Pass an object as the first argument containing the metadata, and a string as the second argument for the descriptive message.
  ```typescript
  logger.info({ userId: user.id, projectId }, 'Project deleted successfully')
  ```
- **Levels**: Use appropriate levels: `debug`, `info`, `warn`, `error`.
