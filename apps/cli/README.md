# Shumai CLI

A Command Line Interface (CLI) tool for interacting with your Shumai instance.

The CLI allows you to view projects, list folder contents, create folders, upload files and directories, and create new versions of existing files directly from the terminal.

---

## Installation

The CLI package is bundled inside the Shumai workspace.

### Environment Setup

Before using the CLI, you must set the following environment variables to authenticate with your Shumai instance:

```bash
# The endpoint of your Shumai API server (e.g. http://localhost:3000)
export SHUMAI_API_SERVER="http://localhost:3000"

# Your personal API Token (Generate this in the WebUI via Settings -> Developer tab)
export SHUMAI_API_KEY="your-developer-api-token"
```

---

## Usage

Run `shumai-cli` or query specific commands:

```bash
shumai-cli <command> [arguments] [options]
```

### Commands

#### 1. List Projects

List all projects you have access to. Returns the project ID, name, and its root folder ID.

```bash
shumai-cli project ls
```

#### 2. List Directory Contents

List direct children (folders and files) of a parent folder.

```bash
shumai-cli ls -p <parentId>
```

- **Options:**
  - `-p`, `--parent <id>`: The parent folder ID (required).

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

---

## Development

To run the CLI in development mode inside the repository source code:

```bash
bun run apps/cli/src/index.ts project ls
```
