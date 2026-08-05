# Web App E2E Tests

Fullstack end-to-end tests for the Shumai web app. They run against a real backend
(pgvector container + local S3 storage) served on `http://localhost:5200` and are
executed with Playwright via `bun run test:e2e`.

## Structure

```
apps/web/e2e/
├── fixtures.ts          # prisma / owner / project / file fixtures
├── serve.ts             # starts the test DB container + web app
├── global-teardown.ts   # stops the container and cleans up storage
├── helpers/
│   ├── auth.ts          # signup / auth-state injection helpers
│   ├── project.ts       # project creation helpers
│   ├── files.ts         # share link API helpers
│   ├── team.ts          # team member seeding helpers
│   └── ui.ts            # common UI flows (signup, login, members dialog)
└── tests/<domain>/      # domain-scoped specs (auth, team, project)
```

## Fixtures

- `prisma` — auto fixture that truncates all tables before each test. Also the
  direct way to read/write DB state for assertions and seeding.
- `owner` — an authenticated team owner (seeded through the API), with the session
  cookie and auth state injected into the browser context, opened on the team page.
- `project` — `owner` plus a project created through the API (`projectId`,
  `projectName`).
- `file` — `project` plus a seeded processed file asset in the project root
  (`fileId`, `fileName`). The media kind is configurable per test via
  `fileOptions` (default `binary`):

  ```ts
  // default binary file (no extension, no proxy)
  test('...', async ({ file }) => {})

  // type-scoped file for future viewer/transcode tests
  test('...', { fileOptions: { mediaType: 'image' } }, async ({ file }) => {})
  ```

  | mediaType | filename | notes |
  |---|---|---|
  | `binary` (default) | `test-file-<ts>` | never transcoded, no proxy |
  | `text` | `test-file-<ts>.txt` | gets a PDF proxy in real usage |
  | `image` | `test-file-<ts>.png` | |
  | `video` | `test-file-<ts>.mp4` | |
  | `pdf` | `test-file-<ts>.pdf` | |
  | `audio` | `test-file-<ts>.wav` | |

## Test Cases

### auth
| Test | File |
|---|---|
| Sign up as the first user and become the team owner | `tests/auth/signup.spec.ts` |
| Log in with existing credentials | `tests/auth/login.spec.ts` |

### team
| Test | File |
|---|---|
| Owner invites a member via invite link and the invitee joins | `tests/team/invite-member.spec.ts` |
| Owner removes a member via the members dialog; the membership is deleted from the DB | `tests/team/remove-member.spec.ts` |
| Owner changes a team member role in the members dialog and permissions update | `tests/team/change-member-role.spec.ts` |

### project
| Test | File |
|---|---|
| Owner creates a project with a cover image | `tests/project/create-project.spec.ts` |
| Owner uploads a file via the "Upload File" context menu action | `tests/project/upload-file.spec.ts` |
| Owner deletes a file, finds it in recently deleted, and restores it | `tests/project/delete-restore.spec.ts` |
| Owner creates a share link from a file context menu and lands on the share page | `tests/project/create-share-link.spec.ts` |
| Owner protects a share with a password; guests must enter it to view | `tests/project/share-password.spec.ts` |
| Owner creates a collection from the sidebar; the collection shows project files | `tests/project/create-collection.spec.ts` |
| Owner invites a member to a project; the member only sees the invited project | `tests/project/invite-member.spec.ts` |
| Owner changes a project member role in the members dialog and permissions update | `tests/project/change-member-role.spec.ts` |
| Owner adds team member to project with role override and permissions enforce project role | `tests/project/role-override.spec.ts` |
| Owner deletes a member from project via the members dialog and project access is revoked | `tests/project/remove-member.spec.ts` |
| Owner drags a file into a folder and a folder into another folder | `tests/project/move-folder-file.spec.ts` |
| Owner drags a file onto a file to create a version stack | `tests/project/version-stack-create.spec.ts` |
| Owner drags a file onto a version stack to add a new version | `tests/project/version-stack-add-version.spec.ts` |
| Owner searches the file list by an English name keyword | `tests/project/search-file-list.spec.ts` |
| Owner searches the file list by Chinese, Japanese, and Korean name keywords | `tests/project/search-file-list.spec.ts` |
| Owner searches the file list with a keyword and a filter condition | `tests/project/search-file-list.spec.ts` |
| Owner saves a search result as a collection | `tests/project/save-search-collection.spec.ts` |

### file
| Test | File |
|---|---|
| Create a comment on a binary file | `tests/file/binary-comment.spec.ts` |
| Upload a txt file, wait for transcode, and create a comment with draw | `tests/file/txt-draw-comment.spec.ts` |
| Upload an image file, wait for transcode, and create a comment with draw | `tests/file/image-draw-comment.spec.ts` |
| Upload a video file, wait for transcode, and create a comment with draw at a non-zero timestamp | `tests/file/video-draw-comment.spec.ts` |
| Upload an audio file, wait for transcode, and create a comment at a non-zero timestamp | `tests/file/audio-timestamp-comment.spec.ts` |

## Conventions


- Seed data via fixtures/API/DB; use the UI only for the flow under test.
- Each test truncates all tables via the auto `prisma` fixture, so fixtures must
  create their data per-test.
- App projects run with `workers: 1` because all tests share a single database.
- Every new test case MUST be documented in this README.
