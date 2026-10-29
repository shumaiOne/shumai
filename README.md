<p align="center">
  <img src="docs/logo-rounded.png" alt="Shumai Logo" width="65" />
</p>

<h1 align="center">Shumai</h1>

<p align="center">
  <strong>The best open-source Frame.io alternative for all your creative work.</strong>
</p>

<p align="center">
  <a href="https://hub.docker.com/r/shumaione/shumai"><img alt="Docker pulls" src="https://img.shields.io/docker/pulls/shumaione/shumai" /></a>
  <a href="https://github.com/shumaiOne/shumai/releases"><img alt="GitHub latest release" src="https://img.shields.io/github/v/release/shumaiOne/shumai" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a target="_blank" href="https://deepwiki.com/shumaiOne/shumai"><img alt="Ask DeepWiki" src="https://img.shields.io/badge/Ask-DeepWiki-6E56CF" /></a>
</p>

<p align="center">
  <a target="_blank" href="https://shumai.one/">Website</a> | <a target="_blank" href="https://docs.shumai.one/getting-started/overview">Docs</a> | <a target="_blank" href="https://staging.shumai.one">Demo</a> | <a target="_blank" href="https://discord.gg/sUzhujK6DD">Discord</a> | <a target="_blank" href="README_CN.md">中文</a>
</p>

![Shumai App Screenshot](docs/screenshot.webp)

## Features

Shumai is an open-source Frame.io alternative built for creative teams to collaborate and share media with ease:

* **S3-Compatible & Local Storage**: Store and serve creative assets securely using the local filesystem or any S3-compatible storage service, including AWS S3, Cloudflare R2, and MinIO.
* **Frame-by-Frame Annotations & Comments**: Leave precise feedback with frame-specific drawing tools and timestamped comments on both video and image assets.
* **Secure Sharing & Collections**: Create private share links and curated media collections for clients, stakeholders, and collaborators.
* **Granular Access Control**: Manage workspace permissions with team-level and project-level role-based access control.
* **Durable Workflows via DBOS**: Run background tasks and AI agent workflows orchestrated reliably by DBOS on PostgreSQL with automatic recovery and fault tolerance.
* **Scalable Deployment on Docker or Kubernetes**: Horizontally autoscale video transcoding on multiple instances. See [EKS Deployment Example](eks/README.md).
* **Custom Asset Metadata**: Define dynamic metadata fields tailored to your production pipeline.
* **Share Link Watermarking**: Protect shared media with customizable text and image watermarks, and save watermark as reusable templates.
* **Wide File Format Support**: Preview common creative file formats, including images (with PSD support), videos, audio, and documents, while allowing any file type to be uploaded and stored.
* **3D Asset Turntable Previews**: Generate interactive 3D model turntable previews and videos for formats like GLB, FBX, OBJ, STL, USD, and DAE using [turntable-renderer](https://docs.shumai.one/using-shumai/3d-asset-support).
* **Office & Document PDF Proxying via Gotenberg**: Convert Word, PowerPoint, Excel, Markdown, HTML, and CSV documents to high-quality PDF proxies for in-browser previewing using [Gotenberg](https://docs.shumai.one/using-shumai/gotenberg).
* **Semantic Search**: Find assets by visual or conceptual meaning using vector embeddings. See [documentation](https://docs.shumai.one/using-shumai/semantic-search).
* **NLE Export & Premiere Pro Plugin (Experimental)**: Export timestamped review comments to your favorite non-linear editor (Premiere Pro XML, DaVinci Resolve EDL, Final Cut Pro, Avid Media Composer) or use the experimental Premiere Pro UXP plugin to import media assets and auto-sync comments directly to sequence timeline markers. See [documentation](https://docs.shumai.one/using-shumai/nle-and-premiere).
* **Built-in MCP Server & CLI**: Connect external AI agents to Shumai via `/mcp` or manage projects, assets, comments, and metadata from the terminal with `shumai-cli`.

But Shumai goes beyond being a Frame.io alternative. With modern models like GPT-Image-2 and Seedance 2.5, AI can already handle a surprising amount of creative work. That means you can create or update videos and images from a simple prompt without having to jump back into Photoshop, Premiere or Houdini. That is why Shumai includes a powerful agent system:

> **AI is optional.** You can use Shumai as a traditional Frame.io alternative and completely ignore the AI features if they aren't useful for your team.

* **Agent as a Team Member**: Mention a context-aware AI agent with `@mentions` directly in asset comments, just like a real teammate.
* **Agent as a One-to-One Assistant**: Chat privately with the agent and ask it to help with tasks.
* **Custom Skills & Tools**: Extend the agent by registering custom scripts, tools, and automation skills.
* **Model Context Protocol (MCP)**: Connect agents to external tools and APIs through remote MCP servers, with OAuth authentication and per-agent MCP access.
* **Isolated Sandbox Execution**: Run agent-submitted scripts safely in a sandboxed environment.
* **AI Metadata Autofill**: Automatically fill in custom metadata for new assets.
* **Resource Quotas**: Set usage limits on AI tokens, costs, and tool execution per member, role, or team-wide, with real-time tracking.

Here is a short demo video showing what the Shumai agent can do:



https://github.com/user-attachments/assets/1186067a-72c0-41b9-836f-987438f2332a

Shumai also brings project management into the creative workflow. A built-in Kanban board helps teams organize tasks, track progress, and collaborate in one place.

The ultimate goal is an **agentic Kanban**, where agents and team members can work together on tasks. This is still a **work in progress**: you can already create tasks for AI agents, but agents cannot act on those tasks yet.

<img width="2880" height="2160" alt="localhost_3000_teams_01M0HQR3EEBS0B46K4FK39X2C8_kanban(1080p-2) (1)" src="https://github.com/user-attachments/assets/cd0648d0-c69a-4398-958b-8d15a33378b0" />



> [!NOTE]
> **Media Processing & Storage:** When uploading media, Shumai always preserves and stores your original raw file. Note that the file size shown in the system represents the original file size and does not include the size of any transcoded files. For all media types (both images and videos), Shumai creates a 300p WebP poster image to serve as the preview in the file list view. Additionally:
> * **For Images:** Shumai generates a high-quality WebP proxy at the exact same resolution as your original file for optimized viewing.
> * **For Videos:** It generates at least one proxy video (depending on your transcoding settings), alongside a sprite image and a small preview video (capped at 1600 frames) to enable fast timeline scrubbing and lightning-quick previews.

Have feedback or ideas? [Share them with us](https://github.com/shumaiOne/shumai/issues/328), and if you find Shumai useful, please give us a ⭐ or recommend Shumai to someone who might find it useful, it really helps!



## Installation

Below is a quickstart guide for running Shumai with local storage. For advanced configuration options (including S3-compatible storage and distributed worker orchestration), see our [Documentation](https://docs.shumai.one/getting-started/overview).

### Option 1: Docker Compose

Docker Compose is the fastest way to get Shumai running. You do not need to clone the repository or install packages manually. Ensure you have [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed, then follow these steps:

1. Create and navigate to a new directory for your configuration and data volumes:
   ```bash
   mkdir shumai && cd shumai
   ```
2. Download your preferred `docker-compose.yaml` configuration based on your needs and available RAM:

   * **Lite (Suggested RAM: 2 GB+)**: Minimal deployment containing Shumai and PostgreSQL database.
     ```bash
     curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.yaml
     ```

   * **With Embedding Server (Suggested RAM: 4 GB+)**: Adds local multimodal semantic search powered by `shumaiOne/embedding-server` (`EmbeddingGemma 2 740M`).
     ```bash
     curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.embedding.yaml
     ```

   * **Full (Suggested RAM: 8 GB+)**: All-in-one setup including `embedding-server`, `turntable-renderer` (3D previews), and `Gotenberg` (document PDF proxying).
     ```bash
     curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.full.yaml
     ```

   > [!NOTE]
   > By default, the Docker Compose setups use CPU software transcoding. If your server has a GPU (NVIDIA NVENC, Intel QuickSync, AMD/Intel VA-API, or Rockchip RKMPP) and you want to enable GPU hardware acceleration, check the [Hardware Transcoding Guide](https://docs.shumai.one/configuration/hardware-transcoding).
3. Configure environment variables:

   * `BETTER_AUTH_URL`: The public base URL of your Shumai server (e.g., `https://shumai.example.com` or `http://12.34.56.78:3000`). This is required for remote servers and production deployments.
   * `AWS_ENDPOINT_URL_S3`: By default, `AWS_ENDPOINT_URL_S3` is set to `http://localhost:{SHUMAI_SERVER_PORT}`. **Note that this also applies to local storage (`STORAGE_BACKEND: local`), not only S3 storage.** If you expose Shumai on a remote server, custom domain, or custom host/port combination, set `AWS_ENDPOINT_URL_S3` to the external URL that client browsers will use to upload and download files.

     For example, if you change the port mapping in `docker-compose.yaml` from `3000:3000` to `12345:3000` and deploy on a server with IP address `12.34.56.78`, set:

     ```yaml
     AWS_ENDPOINT_URL_S3: http://12.34.56.78:12345
     ```

     This value must be reachable from client browsers and should include the externally exposed port.
   * `SHUMAI_SERVER_PORT`: Controls the port the Shumai server listens on. The default is `3000`.
   * **External S3 Storage**: By default, Shumai uses the bundled local storage service in this Docker Compose setup. To use an external S3-compatible storage instead, configure the environment variables for your S3 provider. Here are examples for AWS S3 and Cloudflare R2:

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

4. Start the services in detached mode:
   ```bash
   docker compose up -d
   ```
5. Open your browser and access Shumai at `http://localhost:3000` (or `http://<your-server-ip>:3000` for remote deployments).

#### **Scaling Transcode Workers (Parallel Processing)**

By default, the Docker Compose deployment transcodes videos one-by-one. This is by design, as video transcoding is compute-intensive and can saturate available CPU or GPU resources.

However, when uploading large batches (e.g., 100+ videos at once) or massive raw camera files that take hours to process and block subsequent uploads, you can scale transcoding throughput across additional machines. Each machine still processes tasks sequentially, but adding more worker instances increases overall parallel capacity.

Shumai makes this seamless with a dedicated [`shumaione/shumai-transcode`](https://hub.docker.com/r/shumaione/shumai-transcode) Docker image:

1. **Connect**: Launch a temporary machine and ensure network access to your PostgreSQL database and storage backend (e.g., S3 or shared storage).
2. **Start the worker**: Run the container with matching database and storage credentials:

   ```bash
   docker run -d --name shumai_transcode_worker \
     -e DATABASE_URL="postgres://shumai:shumai_password@<postgres-host>:5432/shumai_db?sslmode=disable" \
     -e STORAGE_BACKEND="s3" \
     -e S3_BUCKET="your-bucket-name" \
     -e AWS_ENDPOINT_URL_S3="https://s3.us-east-1.amazonaws.com" \
     -e S3_ACCESS_KEY_ID="your-access-key-id" \
     -e S3_SECRET_ACCESS_KEY="your-secret-access-key" \
     shumaione/shumai-transcode:latest
   ```

   The worker will automatically attach to the task queue and begin processing pending transcode jobs in parallel with your primary instance.

3. **Stop anytime**: Once the transcoding backlog finishes (or whenever you no longer need the extra compute), simply stop or remove the worker:

   ```bash
   docker stop shumai_transcode_worker
   ```

   There is no downtime or impact on the main Shumai application.

### Option 2: Run from Source (Development)

To set up Shumai locally for development:

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/shumaiOne/shumai.git
   cd shumai
   bun install
   ```
2. Start the `pgvector` database container:
   ```bash
   docker run --name shumai_postgres \
     -e POSTGRES_USER=shumai \
     -e POSTGRES_PASSWORD=shumai_password \
     -e POSTGRES_DB=shumai_db \
     -p 5432:5432 \
     -d pgvector/pgvector:pg18
   ```
3. Create a `.env` file at the root of the workspace:
   ```env
   DATABASE_URL=postgresql://shumai:shumai_password@localhost:5432/shumai_db?schema=public
   BETTER_AUTH_SECRET=ySxs7DxzHDZBbeeHNPEwBuspYwipBqz5Gk5XdBjNhWw=
   BETTER_AUTH_URL=http://localhost:3000
   STORAGE_BACKEND=local
   SHUMAI_SERVER_PORT=3000
   AWS_ENDPOINT_URL_S3=http://localhost:3000
   ```
4. Generate i18n translation files:
   ```bash
   bun run i18n:compile
   ```
   > [!TIP]
   > During frontend development, you can run `bun run i18n:watch` in a separate terminal to automatically recompile translation files whenever you edit strings in `packages/webui/messages/`.
5. Apply the database schema migrations:
   ```bash
   bun run db:migrate
   ```
6. Start the local development server:
   ```bash
   bun run dev
   ```

> [!NOTE]
> Looking to install Shumai globally via NPM or your package manager? See our [NPM Installation Guide](https://docs.shumai.one/getting-started/quickstart).

---

## Command Line Interface (CLI)

Shumai provides a Command Line Interface (CLI) tool to manage projects, folders, and assets, upload files/folders, and create new versions directly from your terminal.

For more details on installation and usage, see the [CLI Readme](apps/cli/README.md).

## MCP Server

Shumai includes a built-in MCP server at `/mcp`, so external agents such as Claude Code, Cursor, or Kiro can browse and organize your projects with an API token. See the [MCP server guide](docs/developer/mcp-server.mdx) for setup.

---

## Community

Thanks to [LINUX DO](https://linux.do/) for providing a community for open-source discussions and feedback.
