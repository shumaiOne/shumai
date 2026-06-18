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

- **S3-Compatible & Local FS Storage**: Securely store and serve your creative assets using local filesystems or any S3-compatible cloud storage (AWS S3, Cloudflare R2, MinIO, etc.).
- **Comments with Draw Annotations & Timestamps**: Give precise feedback with frame-specific drawing tools and exact timestamps directly on video and image assets.
- **Easy Share Links & Collections**: Create secure external share links and curated media collections to collaborate with external clients and stakeholders.
- **Team & Project Member Management**: Manage granular workspace permissions using team-level and project-level role-based access control.
- **Scalable Transcode Workflows via Temporal**: Offload resource-heavy video transcoding to a reliable background worker pool orchestrated by Temporal.
- **Flexible Asset Metadata System**: Customize your workspace metadata with dynamic, user-defined fields tailored to your production pipeline.

#### Shumai Agent

- **Chat with Agent as a Collaborator**: Converse with a context-aware AI agent directly within your project workspace.
- **Extend Agent with Skills**: Easily register new tools and custom skills for the agent to run and automate workflows.
- **Secure Sandboxed Execution**: Execute agent scripts and tasks in a secure, isolated sandbox environment.
- **AI-Powered Metadata Autofill**: Automatically generate tags, descriptions, and custom metadata for new assets using Google Gemini.
- **Semantic Asset Search**: Find assets instantly based on their visual and textual content using vector embeddings.

---

## Installation

### Option 1: Docker Compose (Quick Start)

The easiest way to run Shumai is using Docker Compose. You do not need to clone the repository:

1. Create a `docker-compose.yaml` file by copying the configuration from [GitHub](https://github.com/shumaiOne/shumai/blob/main/docker-compose/local/docker-compose.yaml) or download it directly:
   ```bash
   curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.yaml
   ```
2. Configure environment variables (if deploying remotely):
   If you are deploying Shumai to a remote server (e.g., AWS ECS, EC2, VPS), you must edit `docker-compose.yaml`, set `AWS_ENDPOINT_URL_S3` to your server's public IP or domain name (e.g., `http://12.345.567.789:3000`).
3. Start the services:
   ```bash
   docker compose up -d
   ```
4. Access the application in your browser at `http://localhost:3000` (or `http://<your-server-ip>:3000` for remote deployments).

### Option 2: Install from NPM

You can run Shumai using the npm package `@shumai-one/shumai`. This option allows you to install and run Shumai globally or locally via your favorite package manager.

#### Step 1: Start PostgreSQL with pgvector

Shumai requires PostgreSQL with the `pgvector` extension. You can spin up a pre-configured database container using Docker:

```bash
docker run --name shumai_postgres \
  -e POSTGRES_USER=shumai \
  -e POSTGRES_PASSWORD=shumai_password \
  -e POSTGRES_DB=shumai_db \
  -p 5432:5432 \
  -d pgvector/pgvector:pg18
```

#### Step 2: Install Shumai globally

Install the main Shumai package using `npm`, `pnpm`, `bun`, or `yarn`:

> [!IMPORTANT]
> **Prerequisites**:
>
> - **Agent Sandbox**: Because Shumai uses a secure sandboxed execution environment for its AI agents, your machine must meet the platform requirements for the sandbox. Please verify you have installed the required dependencies for your OS as detailed in the [Agent Sandbox Platform Support](#agent-sandbox-platform-support) section.
> - **FFmpeg & FFprobe**: Shumai requires `ffmpeg` and `ffprobe` to be installed on your system path for handling media transcoding and metadata extraction.
>   - macOS: `brew install ffmpeg`
>   - Ubuntu/Debian: `sudo apt-get install ffmpeg`
>   - Fedora: `sudo dnf install ffmpeg`

```bash
npm install -g @shumai-one/shumai
# or: pnpm add -g @shumai-one/shumai
# or: bun add -g @shumai-one/shumai
```

#### Step 3: Configure Environment Variables

Create a new directory for your Shumai configuration and navigate into it:

```bash
mkdir shumai
cd shumai
```

Create a `.env` file in this folder and add the following configuration (which aligns with the Docker database command in Step 1):

```env
DATABASE_URL=postgresql://shumai:shumai_password@localhost:5432/shumai_db?schema=public
BETTER_AUTH_SECRET=ySxs7DxzHDZBbeeHNPEwBuspYwipBqz5Gk5XdBjNhWw=
STORAGE_BACKEND=local
SHUMAI_SERVER_PORT=3000
AWS_ENDPOINT_URL_S3=http://localhost:3000
```

> [!NOTE]
> If you are deploying on a remote server, make sure to change `AWS_ENDPOINT_URL_S3` from `http://localhost:3000` to your server's public IP address or domain name. `SHUMAI_SERVER_PORT` defaults to `3000` if not set.

#### Step 4: Run Shumai

Start the application from your configuration folder:

```bash
shumai
```

On startup, Shumai will automatically run the necessary database migrations and start the web server at `http://localhost:3000`.

---

### Option 3: Run from Source

To run Shumai locally for development:

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/shumaiOne/shumai.git
   cd shumai
   bun install
   ```
2. Start the `pgvector` database container (as described in Option 2, Step 1).
3. Create a `.env` file at the root of the workspace using the example configuration from Option 2, Step 3.
4. Run the database migrations:
   ```bash
   bun run db:migrate
   ```
5. Start the development server:
   ```bash
   bun run dev
   ```

---

## Advanced: Distributed Execution with Temporal

For production environments or workloads with heavy media processing and AI agent requirements, Shumai can delegate background activities to **Temporal**. This provides distributed queue management, task retries, and high availability.

### How it works

By setting the environment variable `WORKFLOW_EXECUTOR=temporal`, the main Shumai application will delegate background workflows to a Temporal cluster instead of using the local polling-based engine. This allows you to run independent worker processes (`shumai-agent` and `shumai-transcode`) on separate specialized machines (e.g., transcoding workers on GPU-accelerated instances, and agents on sandboxed environments).

> [!IMPORTANT]
> **Storage Requirement**: Because the main Shumai application and the background workers run on different machines in a distributed setup, **you must use S3-compatible storage** (e.g., AWS S3, Cloudflare R2, MinIO). Local storage (`STORAGE_BACKEND=local`) will not work because the workers and the main application do not share a common local filesystem.

### 1. Set up the Core Stack

Spin up the database, Temporal server, and the main Shumai web application on your primary host machine using Docker Compose:

1. Download the Temporal-enabled `docker-compose.yaml` file:
   ```bash
   curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/temporal/docker-compose.yaml
   ```
2. Configure the environment variables in `docker-compose.yaml`:
   - Set the S3 storage environment variables (`AWS_ENDPOINT_URL_S3`, `S3_REGION`, `S3_BUCKET`, etc.).
   - If deploying to a remote host (e.g., AWS ECS, EC2, VPS), update `AWS_ENDPOINT_URL_S3` under the `shumai` service to your server's public IP address or domain name.
   - Note: The `TEMPORAL_ADDRESS` environment variable for the main Shumai application is pre-configured as `temporal:7233` (referencing the Temporal container within the same Docker network) and does not need to be changed.
3. Start the services:
   ```bash
   docker compose up -d
   ```
   This exposes the Shumai Web UI at `http://<host-ip>:3000`, the database at port `5432`, the Temporal gRPC service at port `7233`, and the Temporal dashboard at `http://<host-ip>:8080`. Ensure that port `7233` is exposed and accessible by your background worker machines.

### 2. Run the Background Workers

When running in Temporal mode, the main Shumai application only submits tasks to the Temporal queue. To process these tasks, you must run at least one agent worker and one transcoding worker on their respective machines.

> [!NOTE]
> **Network & Access Requirements**:
>
> - Both the transcode worker and the agent worker must have network access to the PostgreSQL database and the S3-compatible storage.
> - Because the transcode worker needs to download and upload large media files for transcoding, it is highly recommended to deploy the transcode worker in the same cloud provider and region as your S3 storage to minimize transfer latency and data egress fees.

Configure a `.env` file on each worker machine. It must contain the following variables:

```env
DATABASE_URL=postgresql://shumai:shumai_password@<host-ip>:5432/shumai_db?schema=public
WORKFLOW_EXECUTOR=temporal
TEMPORAL_ADDRESS=<host-ip>:7233
STORAGE_BACKEND=s3
AWS_ENDPOINT_URL_S3=http://<host-ip>:3000 # Or your public S3/R2 endpoint URL
S3_REGION=us-east-1
S3_BUCKET=shumai
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
```

Run the workers:

- **Transcoding Worker**:
  Install `@shumai-one/shumai-transcode` and run it on a machine with sufficient transcoding resources:

  > [!IMPORTANT]
  > **FFmpeg Requirement**: The transcoding worker requires `ffmpeg` and `ffprobe` to be installed and available on the machine's system path.
  >
  > - macOS: `brew install ffmpeg`
  > - Ubuntu/Debian: `sudo apt-get install ffmpeg`

  ```bash
  npm install -g @shumai-one/shumai-transcode
  # Run worker with the configured .env
  shumai-transcode
  ```

- **AI Agent Worker**:
  Install `@shumai-one/shumai-agent` and run it on a machine configured for Agent tasks:

  > [!IMPORTANT]
  > Because the AI Agent worker runs sandboxed agent scripts, the host machine must have the necessary dependencies installed. Please refer to [Agent Sandbox Platform Support](#agent-sandbox-platform-support) for setup details.

  ```bash
  npm install -g @shumai-one/shumai-agent
  # Run worker with the configured .env (must include GEMINI_API_KEY)
  shumai-agent
  ```

---

## Agent Sandbox Platform Support

Shumai uses `anthropic-experimental/sandbox-runtime` to execute AI agent scripts and tasks in a secure, isolated sandbox environment. When installing Shumai or the AI Agent worker from NPM, ensure your host platform meets the following requirements:

### Platform Support

- **macOS**: Uses `sandbox-exec` with custom profiles (no additional OS-level containerization dependencies).
- **Linux**: Uses `bubblewrap` (bwrap) for containerization.
- **Windows**: Not yet supported.

### Platform-Specific Dependencies

#### Linux

The following system packages must be installed on your Linux host:

- `bubblewrap` - Container runtime
  - Ubuntu/Debian: `sudo apt-get install bubblewrap`
  - Fedora: `sudo dnf install bubblewrap`
  - Arch: `sudo pacman -S bubblewrap`
- `socat` - Socket relay for proxy bridging
  - Ubuntu/Debian: `sudo apt-get install socat`
  - Fedora: `sudo dnf install socat`
  - Arch: `sudo pacman -S socat`
- `ripgrep` - Fast search tool for deny path detection
  - Ubuntu/Debian: `sudo apt-get install ripgrep`
  - Fedora: `sudo dnf install ripgrep`
  - Arch: `sudo pacman -S ripgrep`

**Ubuntu 24.04+ Note**: These releases restrict unprivileged user namespaces by default. Disable this restriction so that `bubblewrap` and the seccomp isolation layer can function:

```bash
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
```

**Optional Linux Dependencies (for seccomp fallback)**:
Pre-generated seccomp filters are provided for x86-64 and arm architectures. If you run on a different architecture, you will need a C compiler and development files:

- `gcc` or `clang`
- `libseccomp` development headers
  - Ubuntu/Debian: `sudo apt-get install gcc libseccomp-dev`
  - Fedora: `sudo dnf install gcc libseccomp-devel`
  - Arch: `sudo pacman -S gcc libseccomp`

#### macOS

The following dependencies are required on macOS:

- `ripgrep` - Fast search tool for deny path detection
  - Install via Homebrew: `brew install ripgrep`
  - Or download from: https://github.com/BurntSushi/ripgrep/releases
