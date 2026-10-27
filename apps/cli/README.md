# Shumai CLI

A Command Line Interface (CLI) tool for interacting with your Shumai instance.

The CLI allows you to view projects, list folder contents, create folders, upload files and directories, create new versions of existing files, and look at images, video frames, and document pages directly from the terminal.

---

## Installation

The CLI package is bundled inside the Shumai workspace. The published npm package (`@shumai-one/shumai-cli`) requires Node.js 22.12 or later.

### Environment Setup

Before using the CLI, you must set the following environment variables to authenticate with your Shumai instance:

```bash
# The endpoint of your Shumai API server (e.g. http://localhost:3000)
export SHUMAI_API_SERVER="http://localhost:3000"

# Your personal API Token (Generate this in the WebUI via Settings -> API Tokens tab).
# The token is shown only once when it is created, so copy it right away.
export SHUMAI_API_KEY="your-developer-api-token"

# Optional: Enable asset deletion capability (disabled by default for safety)
export SHUMAI_ALLOW_DELETE="true"
```

---

## Usage

> [!IMPORTANT]
> **For Bun Users:** Since the package binary contains a `#!/usr/bin/env node` shebang, running `shumai-cli` directly will run under Node.js. If you wish to run it using Bun, prefix the command with `bun run --bun` (e.g., `bun run --bun shumai-cli project ls`).

Run `shumai-cli` or query specific commands:

```bash
shumai-cli <command> [arguments] [options]
```

Run `shumai-cli --help` to list all commands, and `shumai-cli <command> --help` for a command's arguments and options.

### Global Options

- `--json`: Print the raw JSON result instead of human-friendly text, for scripts and tools like `jq`. Example: `shumai-cli ls -p <parentId> --json | jq '.data[].id'`.

When the output is piped instead of shown in a terminal, tables are printed as tab-separated values without headers.

### Commands

#### 1. List Projects

List all projects you have access to. Returns the project ID, name, and its root folder ID.

```bash
shumai-cli project ls
```

#### 2. List Directory Contents

List direct children (folders and files) of a parent folder. Folders are listed first.

```bash
shumai-cli ls -p <parentId>
```

- **Options:**
  - `-p`, `--parent <id>`: The parent folder ID (required).
  - `--type <type>`: Only list `file`, `folder`, or `all` (default).
  - `--first <n>`: Maximum number of items to list (default and maximum: 200).
  - `--after <cursor>`: Continue a long listing. When more items exist, `ls` prints the cursor to pass here.

#### 3. Create a New Folder

Create a new folder under a parent folder.

```bash
shumai-cli mkdir <name> -p <parentId>
```

- **Options:**
  - `-p`, `--parent <id>`: The parent folder ID (required).

#### 4. Upload Files or Folders

Upload a local file or folder to a target parent folder. File sizes and paths are mapped, and uploads are streamed chunk-by-chunk with a progress bar.

```bash
shumai-cli upload <localPath> -p <parentId>
```

- **Options:**
  - `-p`, `--parent <id>`: The parent folder ID (required).

#### 5. Create a New Version of a File

Upload a local file as a new version of an existing asset (which must be a file or a version stack). This wraps the assets into a version stack dynamically on the server.

```bash
shumai-cli create-version <localFilePath> -p <parentAssetId>
```

- **Options:**
  - `-p`, `--parent <id>`: The parent asset ID (file or version stack) to version (required).

#### 6. Rename an Asset

Rename an existing file or folder in Shumai.

```bash
shumai-cli rename <assetId> <newName>
```

#### 7. Move Assets

Move one or more assets (files or folders) to a destination parent folder. Note that all assets to be moved must belong to the same current parent folder.

```bash
shumai-cli move <assetId...> -p <parentId>
# or using the short alias:
shumai-cli mv <assetId...> -p <parentId>
```

- **Options:**
  - `-p`, `--parent <id>`: The destination parent folder ID (required).

#### 8. Delete an Asset

Delete a single file or folder by moving it to the Trash bin. For safety, this command only deletes one asset at a time and requires the `SHUMAI_ALLOW_DELETE="true"` environment variable to be set in your environment.

```bash
shumai-cli delete <assetId>
# or using the short alias:
shumai-cli rm <assetId>
```

#### 9. Read an Asset

Look at a file: an image, video frames, PDF pages, a 3D model view, or the text of a text file. Prints a summary and a link to each image (links are valid for about an hour), or the file's text.

```bash
# An image, or the 4-view overview of a 3D model
shumai-cli read <assetId>
# 5 evenly spaced frames between 0s and 30s of a video, downloaded into ./frames
shumai-cli read <assetId> --video-start 0 --video-end 30 --video-count 5 --out frames
# Pages 1 to 3 of a PDF, or the text of a text file
shumai-cli read <assetId> --doc-mode pages --doc-start-page 1 --doc-end-page 3
shumai-cli read <assetId> --doc-mode text
# A 3D model at 90°
shumai-cli read <assetId> --degree 90
```

- **Options:**
  - `--video-start <s>`, `--video-end <s>`, `--video-count <n>`: Video frames to extract (up to 20).
  - `--doc-mode <pages|text>`, `--doc-start-page <n>`, `--doc-end-page <n>`: PDF pages to render (up to 20), or `text` to read a text file.
  - `--degree <deg>`: 3D model angle (0, 15, 30, ..., 345).
  - `--annotation-id <id>`: Draw a comment's markup on the image, frame, or page.
  - `-o`, `--out <dir>`: Download the images into a folder and print their paths. With `--json`, each image also gets a `path`.
  - `--max-wait-seconds <s>`, `--no-wait`: Rendering frames or pages can take a while. `read` waits up to 2 minutes; use these to wait less or return right away. If the render isn't done, `read` prints the `render` command to run next.

#### 10. Get a Render

Get the result of a `read` that was still rendering. Takes the same `--out`, `--max-wait-seconds`, and `--no-wait` options as `read`.

```bash
shumai-cli render <taskId> --out frames
```

#### 11. Download Files

Download up to 50 files at once. By default it saves the web preview version when there is one (for example the transcoded video or the web image), which is smaller; use `--original` for the uploaded file. A version stack downloads its latest version. Folders aren't supported: download the files inside them. Files keep their names; if a name is taken, the new file gets a number, like `clip (2).mp4`.

```bash
shumai-cli download <assetId...> --out ./downloads
shumai-cli download <assetId> --original
```

- **Options:**
  - `-o`, `--out <dir>`: Folder to save the files in (default: the current folder). With `--json`, each file also gets a `path`.
  - `--original`: Download the original uploaded files instead of the web previews.

#### 12. Search Files

Search a folder and all of its subfolders by name, or by meaning with `--semantic` (when AI search is enabled for the team).

```bash
shumai-cli search <query> -p <folderId>
shumai-cli search "a calm beach at sunset" -p <folderId> --semantic
```

- **Options:**
  - `-p`, `--parent <id>`: The folder to search in (required).
  - `--type <file|folder>`: Search files (default) or folders.
  - `--first <n>`, `--after <cursor>`: Page through many results.

#### 13. Copy Assets

Copy files or folders into another folder of the same team. Prints the IDs of the copies.

```bash
shumai-cli copy <assetId...> -p <parentId> [--with-comments]
# or using the short alias:
shumai-cli cp <assetId...> -p <parentId>
```

#### 14. Comments

```bash
# List the comments on a file, with their replies
shumai-cli comment ls <assetId>
# Comment on a file, optionally at a timecode (seconds), or reply to a comment
shumai-cli comment add <assetId> "The logo is too small" --at 12.5
shumai-cli comment add <assetId> "Fixed in v2" --reply-to <commentId>
# Mark a comment as resolved, or unresolved again
shumai-cli comment resolve <commentId>
shumai-cli comment resolve <commentId> --reopen
```

#### 15. Metadata

```bash
# List a project's metadata fields and their choices
shumai-cli field ls <projectId>
# Set metadata values on a file, as JSON keyed by field key (select fields take an option id)
shumai-cli meta set <assetId> --values '{"status": "approved", "rating": 4}'
```

#### 16. Version Stacks

```bash
# Stack files in the same folder as versions; the first file is the latest
shumai-cli version stack <fileId...>
# List the versions in a stack, latest first
shumai-cli version ls <stackId>
# Take a version out of its stack (the file is kept)
shumai-cli version unstack <versionId>
```

#### 17. Folder Instructions

Show a folder's instructions for AI agents (its AGENTS.md).

```bash
shumai-cli instructions <folderId>
```

---

## Development

To run the CLI in development mode inside the repository source code:

```bash
bun run apps/cli/src/index.ts project ls
```

### Adding Commands

Most commands are generated from the shared Operation definitions in `packages/operations` (see "Operations" in `AGENTS.md`). An Operation with the `cli` surface and a `cli` spec becomes a command automatically, with arguments, options, and help text derived from its input schema (key/value inputs such as `meta set --values` take a JSON object). It is also available to Shumai's built-in agent and MCP server. Behavior that needs the local machine, such as downloading files, goes in a CLI extension in `src/operations/extensions/` (extra options, input mapping, and output). Only commands that stream local files (`upload`, `create-version`) are written by hand in `src/program.ts`; the `create_file`, `create_version`, and `complete_upload` Operations are for the agent and MCP only.
