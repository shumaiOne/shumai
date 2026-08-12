<p align="center">
  <img src="docs/logo-rounded.png" alt="Shumai Logo" width="65" />
</p>

<h1 align="center">Shumai</h1>

<p align="center">
  <strong>An open-source platform for all your creative work.</strong>
</p>

<p align="center">
  <a target="_blank" href="https://shumai.one/">Website</a> | <a target="_blank" href="https://docs.shumai.one/introduction">Docs</a> | <a target="_blank" href="https://staging.shumai.one">Demo</a> | <a target="_blank" href="https://discord.gg/sUzhujK6DD">Discord</a> | <a target="_blank" href="README_CN.md">中文</a>
</p>

![Shumai App Screenshot](docs/screenshot.webp)

## Features

Shumai is an open-source Frame.io alternative built for creative teams to collaborate and share media with ease:

* **S3-Compatible & Local Storage**: Store and serve creative assets securely using the local filesystem or any S3-compatible storage service, including AWS S3, Cloudflare R2, and MinIO.
* **Frame-by-Frame Annotations & Comments**: Leave precise feedback with frame-specific drawing tools and timestamped comments on both video and image assets.
* **Secure Sharing & Collections**: Create private share links and curated media collections for clients, stakeholders, and collaborators.
* **Granular Access Control**: Manage workspace permissions with team-level and project-level role-based access control.
* **Distributed Transcoding via Temporal**: Offload resource-intensive video transcoding to a background worker pool orchestrated by Temporal.
* **Custom Asset Metadata**: Define dynamic metadata fields tailored to your production pipeline.
* **Share Link Watermarking**: Protect shared media with customizable text and image watermarks, and save watermark as reusable templates.
* **Wide File Format Support**: Preview common creative file formats, including images (with PSD support), videos, audio, and documents, while allowing any file type to be uploaded and stored.
* **Office & Document PDF Proxying via Gotenberg**: Convert Word, PowerPoint, Excel, Markdown, HTML, and CSV documents to high-quality PDF proxies for in-browser previewing using [Gotenberg](https://docs.shumai.one/using-shumai/gotenberg).

But Shumai goes beyond being a Frame.io alternative. With modern models like GPT-Image-2 and Seedance 2.5, AI can already handle a surprising amount of creative work. That means you can create or update videos and images from a simple prompt without having to jump back into Photoshop, Premiere or Houdini. That is why Shumai includes a powerful agent system:

* **Agent as a Team Member**: Mention a context-aware AI agent with `@mentions` directly in asset comments, just like a real teammate.
* **Agent as a One-to-One Assistant**: Chat privately with the agent and ask it to help with tasks.
* **Custom Skills & Tools**: Extend the agent by registering custom scripts, tools, and automation skills.
* **Model Context Protocol (MCP)**: Connect agents to external tools and APIs through remote MCP servers, with OAuth authentication and per-agent MCP access.
* **Isolated Sandbox Execution**: Run agent-submitted scripts safely in a sandboxed environment.
* **AI Metadata Autofill**: Automatically fill in custom metadata for new assets.
* **Semantic Search**: Find assets by visual or conceptual meaning using vector embeddings (Gemini Embedding 2).

Here is a short demo video showing what the Shumai agent can do:



https://github.com/user-attachments/assets/1186067a-72c0-41b9-836f-987438f2332a



> [!NOTE]
> **Media Processing & Storage:** When uploading media, Shumai always preserves and stores your original raw file. Note that the file size shown in the system represents the original file size and does not include the size of any transcoded files. For all media types (both images and videos), Shumai creates a 300p WebP poster image to serve as the preview in the file list view. Additionally:
> * **For Images:** Shumai generates a high-quality WebP proxy at the exact same resolution as your original file for optimized viewing.
> * **For Videos:** It generates at least one proxy video (depending on your transcoding settings), alongside a sprite image and a small preview video (capped at 1600 frames) to enable fast timeline scrubbing and lightning-quick previews.

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
3. Configure environment variables (optional):

   * `SHUMAI_SERVER_PORT` controls the port the Shumai server listens on. The default is `3000`.
   * By default, Shumai uses the bundled local storage service in this Docker Compose setup. To use an external S3-compatible storage instead, configure the environment variables for your S3 provider. Here are examples for AWS S3 and Cloudflare R2:

     **AWS S3 Example:**
     ```yaml
     STORAGE_BACKEND: s3
     S3_BUCKET: your-bucket-name
     S3_ACCESS_KEY_ID: your-access-key-id
     S3_SECRET_ACCESS_KEY: your-secret-access-key
     AWS_ENDPOINT_URL_S3: https://s3.us-east-1.amazonaws.com
     ```

     **Cloudflare R2 Example:**
     ```yaml
     STORAGE_BACKEND: s3
     S3_BUCKET: your-bucket-name
     S3_REGION: auto
     S3_ACCESS_KEY_ID: your-access-key-id
     S3_SECRET_ACCESS_KEY: your-secret-access-key
     AWS_ENDPOINT_URL_S3: https://<account-id>.r2.cloudflarestorage.com
     ```
   * By default, `AWS_ENDPOINT_URL_S3` is set to: `http://localhost:{SHUMAI_SERVER_PORT}`, if you use local storage and expose Shumai on a custom host/port combination, set `AWS_ENDPOINT_URL_S3` to the external URL that browsers will use to upload files.

     For example, if you change the port mapping in `docker-compose.yaml` from `3000:3000` to `12345:3000` and deploy on a server with IP address `12.34.56.78`, set:

     ```
     AWS_ENDPOINT_URL_S3: http://12.34.56.78:12345
     ```

     This value must be reachable from client browsers and should include the externally exposed port.

5. Start the services in detached mode:
   ```bash
   docker compose up -d
   ```
6. Open your browser and access Shumai at `http://localhost:3000` (or `http://<your-server-ip>:3000` for remote deployments).

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

#### Linux

Shumai requires the following system packages on Linux:

- **`ffmpeg`** – Used for media transcoding and metadata extraction.
- **`poppler`** (`poppler-utils`) – Used for PDF page image extraction and PDF sprite preview generation (`pdftoppm`).
- **`imagemagick`** – Used for PSD format transcoding and color profile conversion to sRGB.
- **`bubblewrap`**, **`socat`**, and **`ripgrep`** – Required by the AI agent sandbox (`anthropic-experimental/sandbox-runtime`) for process isolation, networking, and workspace search.

Install all required packages with one command:

> Ubuntu/Debian
```bash
sudo apt install -y ffmpeg poppler-utils imagemagick bubblewrap socat ripgrep
```

> Fedora
```bash
sudo dnf install -y ffmpeg poppler-utils ImageMagick bubblewrap socat ripgrep
```

> Arch Linux
```bash
sudo pacman -S --noconfirm ffmpeg poppler imagemagick bubblewrap socat ripgrep
```

> [!NOTE]
> **Ubuntu 24.04+** restricts unprivileged user namespaces by default. This prevents `anthropic-experimental/sandbox-runtime` from using `bubblewrap` for sandbox isolation.
>
> To temporarily allow user namespaces:
>
> ```bash
> sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
> ```
>
> Alternatively, configure an AppArmor profile that grants the required `userns` permission to the relevant binaries.

---

#### macOS

Shumai requires:

- **`ffmpeg`** – Used for media transcoding and metadata extraction.
- **`poppler`** – Used for PDF page image extraction and PDF sprite preview generation (`pdftoppm`).
- **`imagemagick`** – Used for PSD format transcoding and color profile conversion to sRGB.
- **`ripgrep`** – Required by the AI agent sandbox (`anthropic-experimental/sandbox-runtime`).

Install the required packages with Homebrew:

```bash
brew install ffmpeg poppler imagemagick ripgrep
```

---

#### Windows (alpha)

> [!WARNING]
> Windows support in anthropic-experimental/sandbox-runtime is **alpha and the design is in flux**.
>
> The current implementation provides:
> - Network egress filtering via the **Windows Filtering Platform (WFP)**.
> - File read/write denial via **ACL stamping**.
>
> However, it is **not a security boundary against a deliberately adversarial sandboxed process**.
>
> The sandbox implementation will be substantially revised in a future release, where sandboxed processes will run under a dedicated sandbox user account.

Shumai requires:

- **`ffmpeg`** – Used for media transcoding and metadata extraction.
- **`imagemagick`** – Used for PSD format transcoding and color profile conversion to sRGB.

Install required packages using your preferred package manager:

**winget**
```powershell
winget install Gyan.FFmpeg ImageMagick.ImageMagick
```

**Chocolatey**
```powershell
choco install ffmpeg imagemagick
```

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
# Optional: base URL for MCP OAuth redirects (defaults to BETTER_AUTH_URL)
MCP_OAUTH_REDIRECT_BASE_URL=http://localhost:3000
```

> [!NOTE]
> `SHUMAI_SERVER_PORT` sets the port the server starts on, while `AWS_ENDPOINT_URL_S3` is used by the browser to build file upload URLs.
> If deploying on a remote server (e.g. `http://123.456.7.8`) with a mapped port (e.g. `12345:3000` in docker-compose), set `AWS_ENDPOINT_URL_S3` to `http://123.456.7.8:12345`.
> `MCP_OAUTH_REDIRECT_BASE_URL` is only needed when MCP servers use OAuth: the authorization redirect URI defaults to `{BETTER_AUTH_URL}/api/mcp/oauth/callback`; set it to an externally reachable URL if the app is served behind a proxy.

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
