# Code Quality Review: Project Recently Viewed Files

## Context

Reviewed `main...d0b3358b` (PR #348), which adds per-user/project recent-file persistence, API endpoints, the project Recents page, view recording, and related UI and E2E coverage.

## Findings

### Critical: recent-view recording is not scoped to the requested project or to files

`AssetService.recordRecentView` loads the asset by only `assetId` and then ignores the selected `projectId` (`packages/core/src/asset/asset.ts:2373-2378`). An authenticated user with read access to project A can POST project A's view endpoint with an asset ID from project B. The service stores that asset under project A, and `listRecents` later returns its `AssetInfo` (including generated preview/media URLs) from project A's Recents response. The same endpoint also accepts folders and other asset types despite being a file-view endpoint.

Constrain the initial asset lookup to `id` plus `projectId`, ensure a resolved version-stack parent belongs to the same project, and reject or ignore unsupported asset types. Add service/API regression tests for cross-project assets and non-file assets. The existing `projectId` selection appears to be the omitted guard.

### Required: Recents is still able to mutate assets through drag-and-drop

The Recents-specific external-drag and context-menu guards do not disable the internal DnD provider. `FileSystemManager` enables the pointer sensor whenever the user can edit (`packages/webui/components/file-system-manager.tsx:435-443`), even when `isRecents` is true. `useFileSystemDnd` can therefore send `reparent`/`order` requests when a recent item is dragged onto a folder or reorder target, and can also add it to a share or chatbot. This changes the real asset while the user is browsing a derived, read-only list.

Include `isRecents` in the sensor disable condition (or make the DnD hook explicitly read-only) and add an E2E assertion that dragging a recent item does not change its parent/order.

### Required: per-item menus still expose destructive actions on Recents

The page-level right-click menu is suppressed, but `FileCard`/`FolderCard` still render their own overflow `DropdownMenu`s. `FileSystemManager` passes `isRecents` only to `FileBrowser`; it is not passed to those cards, so an editor can open a recent file's overflow menu and invoke rename or delete (`packages/webui/components/file-browser/file-card.tsx:316-327`, with the same pattern in `folder-card.tsx`). The selection bar also retains Download. At minimum, hide or make the per-item controls read-only on Recents; if downloading is intentionally allowed, keep only that action. Extend the E2E test to exercise the overflow button and verify no mutating action is available.

### Consider: make recent ordering deterministic

Both listing and pruning order only by `viewedAt` (`packages/core/src/asset/asset.ts:2421-2424` and `2461-2464`). Multiple requests can receive the same JavaScript millisecond timestamp, leaving PostgreSQL free to reorder ties. Offset-based pagination can then skip or repeat an item between requests, and pruning can retain an arbitrary item at a tie. Add a stable secondary key, such as `id DESC`, to both orderings and cover equal timestamps in a service test.

## Positive observations

- The API performs project-level authorization before invoking either Recents operation.
- View recording is idempotent per user/project/asset through the compound unique constraint.
- The service tests cover ordering, repeat views, version-stack resolution, user isolation, soft deletion, and the 100-item cap.
- The new route follows the repository's route code-splitting and i18n patterns.

## Verification

- `bun run lint` passed.
- `bun run format` passed with no changes.
- `bun run typecheck` passed.
- `bun run test` passed: 129 files, 1280 tests.
- Targeted API/core tests passed: 3 files, 33 tests.
- `bun run test:e2e:app` passed: 38 tests.
- `bun run test:e2e:webui` passed: 9 tests.
- `bun run test:e2e:workflow` passed: 14 files, 58 tests.
- `git diff --check` reports trailing whitespace in tracked Prisma-generated files; these paths are excluded from the repository's Prettier run.

## Verdict

Request changes. The project-scoping gap is a security/data-isolation issue, and the Recents UI still permits asset mutation through DnD and item overflow menus despite presenting itself as a read-only recent-files view.
