<p align="center">
  <img src="docs/logo-rounded.png" alt="Shumai Logo" width="65" />
</p>

<h1 align="center">Shumai</h1>

<p align="center">
  <strong>An open-source platform for all your creative work.</strong>
</p>

<p align="center">
  <a target="_blank" href="https://shumai.one/">Website</a> | <a target="_blank" href="https://docs.shumai.one/introduction">Docs</a> | <a target="_blank" href="https://staging.shumai.one">Demo</a>
</p>

![Shumai App Screenshot](docs/screenshot.webp)

## Features

- **S3-Compatible & Local Storage**: Securely store and serve your creative assets using a local filesystem or any S3-compatible cloud storage (AWS S3, Cloudflare R2, MinIO, etc.).
- **Frame-by-Frame Annotations & Comments**: Give precise feedback using frame-specific drawing tools and timestamped comments directly on video and image assets.
- **Secure Sharing & Collections**: Create secure public share links and curated media collections to collaborate with clients and stakeholders.
- **Granular Access Control**: Manage workspace permissions using team-level and project-level role-based access controls.
- **Distributed Transcoding via Temporal**: Offload resource-heavy video transcoding to a background worker pool orchestrated by Temporal.
- **Custom Asset Metadata**: Define and customize dynamic metadata fields tailored to your production pipeline.

#### Shumai Agent

- **Collaborative AI Chat**: Converse with a context-aware AI agent directly within your project workspace.
- **Custom Skills & Tools**: Extend the agent's capabilities by registering custom scripts, tools, and automation skills.
- **Isolated Sandbox Execution**: Run agent-submitted scripts securely within a sandboxed environment.
- **AI-Powered Metadata Autofill**: Automatically generate tags, descriptions, and custom metadata for new assets using Google Gemini.
- **Semantic Search**: Locate assets instantly based on visual or conceptual search queries using vector embeddings.

---

## Installation

Below is a quickstart guide for running Shumai with local storage. For advanced configuration options (including S3-compatible storage and Temporal workflow orchestration), see our [Documentation](https://docs.shumai.one/getting-started/overview).

### Option 1: Docker Compose

Docker Compose is the fastest way to get Shumai running. You do not need to clone the repository or install packages manually. Ensure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed, then follow these steps:

1. Create and navigate to a new directory for your configuration and data volumes:
   ```bash
   mkdir shumai && cd shumai
   ```
2. Download the `docker-compose.yaml` file:
   ```bash
   curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.yaml
   ```
3. **Configure Environment Variables (Remote / Custom Port Deployments only):**
   If exposing Shumai on a custom host/port combination (for example, if you change host port mapping to `12345:3000` in `docker-compose.yaml` and deploy on server `http://12.34.56.78`):
   - Set `SHUMAI_SERVER_PORT: 3000` (the internal port the app starts on inside the container).
   - Set `AWS_ENDPOINT_URL_S3: http://12.34.56.78:12345` (the external address including port used by client browsers to upload files).
4. Start the services in detached mode:
   ```bash
   docker compose up -d
   ```
5. Open your browser and access Shumai at `http://localhost:3000` (or `http://<your-server-ip>:3000` for remote deployments).

### Option 2: Install via NPM / Package Manager

Shumai is published as `@shumai-one/shumai` on NPM. This option allows you to run Shumai globally or locally.

#### Step 1: Start PostgreSQL with pgvector

Shumai requires PostgreSQL with the `pgvector` extension. Start a pre-configured database container using Docker:

```bash
docker run --name shumai_postgres \
  -e POSTGRES_USER=shumai \
  -e POSTGRES_PASSWORD=shumai_password \
  -e POSTGRES_DB=shumai_db \
  -p 5432:5432 \
  -d pgvector/pgvector:pg18
```

#### Step 2: Create a workspace folder

Create a dedicated directory to store your environment configuration and media files (which are saved in a `./data` directory by default):

```bash
mkdir shumai && cd shumai
```

#### Step 3: Install Platform-Specific Dependencies

Make sure the following system dependencies are installed on your host machine before installing Shumai:

| Package        | Description                                             | Ubuntu/Debian                    | Fedora                           | Arch                                    | macOS                  |
| :------------- | :------------------------------------------------------ | :------------------------------- | :------------------------------- | :-------------------------------------- | :--------------------- |
| **ffmpeg**     | Media transcoding and metadata extraction               | `sudo apt install -y ffmpeg`     | `sudo dnf install -y ffmpeg`     | `sudo pacman -S --noconfirm ffmpeg`     | `brew install ffmpeg`  |
| **bubblewrap** | Sandboxing environment for secure AI agent execution    | `sudo apt install -y bubblewrap` | `sudo dnf install -y bubblewrap` | `sudo pacman -S --noconfirm bubblewrap` | _NOT REQUIRED_         |
| **socat**      | Bidirectional socket relay for sandbox network bridging | `sudo apt install -y socat`      | `sudo dnf install -y socat`      | `sudo pacman -S --noconfirm socat`      | `brew install socat`   |
| **ripgrep**    | Fast search tool for workspace security policies        | `sudo apt install -y ripgrep`    | `sudo dnf install -y ripgrep`    | `sudo pacman -S --noconfirm ripgrep`    | `brew install ripgrep` |

> [!NOTE]
> **Ubuntu 24.04+ Note:** These releases restrict unprivileged user namespaces by default. To allow `bubblewrap` and the sandbox isolation layer to function, disable this restriction:
>
> ```bash
> sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
> ```
>
> Alternatively, configure an AppArmor profile that grants user namespace creation (`userns`) privileges to the relevant binaries.

#### Step 4: Install Shumai globally

Install Shumai globally using your preferred package manager:

```bash
# NPM
npm install -g @shumai-one/shumai

# PNPM
pnpm add -g @shumai-one/shumai

# Bun
bun add -g @shumai-one/shumai
```

#### Step 5: Configure Environment Variables

Create a `.env` file in your workspace folder (`shumai/`) and add the following configuration:

```env
DATABASE_URL=postgresql://shumai:shumai_password@localhost:5432/shumai_db?schema=public
BETTER_AUTH_SECRET=ySxs7DxzHDZBbeeHNPEwBuspYwipBqz5Gk5XdBjNhWw=
STORAGE_BACKEND=local
SHUMAI_SERVER_PORT=3000
AWS_ENDPOINT_URL_S3=http://localhost:3000
```

> [!NOTE]
> `SHUMAI_SERVER_PORT` sets the port the server starts on, while `AWS_ENDPOINT_URL_S3` is used by the browser to build file upload URLs.
> If deploying on a remote server (e.g. `http://123.456.7.8`) with a mapped port (e.g. `12345:3000` in docker-compose), set `AWS_ENDPOINT_URL_S3` to `http://123.456.7.8:12345`.

#### Step 6: Run Shumai

> [!IMPORTANT]
> **For Bun Users:** Since the published package binaries contain a `#!/usr/bin/env node` shebang, running the global command directly (e.g., `shumai`) will execute under Node.js. If you installed with Bun and want to run under the Bun runtime, you must prefix all commands with `bun run --bun` (e.g., `bun run --bun shumai`, `bun run --bun shumai -d`, `bun run --bun shumai stop`).

Start the application from your workspace folder:

```bash
shumai
```

Alternatively, you can run and manage Shumai in daemon mode:

- **Start in daemon mode**:
  ```bash
  shumai -d
  ```
- **Stop Shumai**:
  ```bash
  shumai stop
  ```
- **Restart Shumai**:
  ```bash
  shumai restart
  ```
- **Show/tail logs**:
  ```bash
  shumai logs
  ```

On startup, Shumai will automatically run database migrations and start the web server at `http://localhost:3000`.

---

### Option 3: Run from Source (Development)

To set up Shumai locally for development:

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/shumaiOne/shumai.git
   cd shumai
   bun install
   ```
2. Start the `pgvector` database container (as described in **Option 2, Step 1**).
3. Create a `.env` file at the root of the workspace using the configuration from **Option 2, Step 5**.
4. Apply the database schema migrations:
   ```bash
   bun run db:migrate
   ```
5. Start the local development server:
   ```bash
   bun run dev
   ```

---

## Command Line Interface (CLI)

Shumai provides a Command Line Interface (CLI) tool to manage projects, folders, and assets, upload files/folders, and create new versions directly from your terminal.

For more details on installation and usage, see the [CLI Readme](apps/cli/README.md).
