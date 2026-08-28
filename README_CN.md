<p align="center">
  <img src="docs/logo-rounded.png" alt="Shumai Logo" width="65" />
</p>

<h1 align="center">Shumai</h1>

<p align="center">
  <strong>为创意工作打造的开源协作平台。</strong>
</p>

<p align="center">
  <a target="_blank" href="https://shumai.one/">官方网站</a> | <a target="_blank" href="https://docs.shumai.one/getting-started/overview">文档</a> | <a target="_blank" href="https://staging.shumai.one">在线演示</a> | <a target="_blank" href="README.md">English</a>
</p>
</p>

![Shumai 应用截图](docs/screenshot.webp)

## 功能

Shumai 是一个开源的 Frame.io 替代方案，专为创意团队打造，让大家能更轻松地协作、审片和分享素材：

* **支持 S3 和本地存储**：你可以把创意素材安全地存到本地文件系统，或者任意兼容 S3 的存储服务里，比如 AWS S3、Cloudflare R2、MinIO 等。
* **逐帧标注和评论**：支持按帧进行精确反馈，可以直接在视频和图片素材上画重点、写评论，还能留下时间戳。
* **安全分享和合集管理**：可以生成私密分享链接，也能整理成精选合集，方便给客户、同事和合作方查看。
* **细粒度权限控制**：支持按团队、项目设置角色权限，方便管理不同成员的访问范围。
* **基于 Temporal 的分布式转码**：把吃资源的视频转码任务交给后台 worker 池处理，由 Temporal 统一调度。
* **自定义素材元数据**：可以按你的制作流程，自由定义动态元数据字段。
* **分享链接水印**：通过可自定义的文字和图片水印保护共享媒体，并将水印配置保存为模板以便重复使用。
* **丰富的文件格式支持**：支持预览常见创意文件格式，包括图片（支持 PSD）、视频、音频和文档，同时可上传和存储任意类型的文件。
* **基于 Gotenberg 的文档 PDF 转码代理**：通过集成 [Gotenberg](https://docs.shumai.one/using-shumai/gotenberg) 支持将 Word、PowerPoint、Excel、Markdown、HTML 和 CSV 文档高质量转换为 PDF 代理文件进行在线预览。

但 Shumai 不仅仅只满足于 Frame.io 的开源替代。随着 GPT-Image-2、Seedance 2.5 这类强大模型的问世，AI已经生成产品级的图片/视频。很多时候，你只要给一句提示词，就能直接生成或修改图片和视频，而不用再打开 Photoshop、Premiere 或者 Houdini。也正因为这样，Shumai 才把 AI Agent 做成了核心能力：

* **Agent 就像团队成员**：你可以在素材评论区里直接用 `@` 提到 AI Agent，像拉一个真实同事进来一起看稿一样。
* **Agent 也能当你的私聊助手**：你可以单独和它聊天，让它帮你查东西、做任务。
* **自定义技能和工具**：你可以给 Agent 接上自己的脚本、工具和自动化能力。
* **Model Context Protocol (MCP) 支持**：通过远程 MCP 服务端为 Agent 接入外部工具与 API，支持 OAuth 鉴权与按 Agent 独立分配访问权限。
* **沙箱隔离执行**：Agent 生成的脚本会在隔离环境里运行，更安全。
* **AI 自动补全元数据**：新素材上传后，系统可以自动帮你补一些元数据。
* **语义搜索**：支持按画面内容或语义找素材，底层用的是向量 embedding（Gemini Embedding 2）。
* **资源配额**：支持按成员、角色或全团队对 AI Token、成本和工具调用设置使用上限与实时用量监控。

下面是一个简短的 demo 视频，展示了 Shumai Agent 能做什么：

https://github.com/user-attachments/assets/1186067a-72c0-41b9-836f-987438f2332a

Shumai 也将项目管理融入了创意工作流程。 内置的看板可以帮助团队整理任务以及跟踪进度。

最终目标是打造一个 Agentic看板，让 Agent 和团队成员能够围绕同一个目标协同工作。目前这一功能仍在开发中: 你已经可以在看板中为 Agent 创建任务，但 Agent 目前还无法自动执行这些任务。

<img width="2880" height="2160" alt="localhost_3000_teams_01M0HQR3EEBS0B46K4FK39X2C8_kanban(1080p-2) (1)" src="https://github.com/user-attachments/assets/29ff1db1-2d65-4e3c-b467-754b777b406f" />


> [!NOTE]
> **媒体处理与存储机制：** 上传媒体文件后，Shumai 始终会保留并存储原始文件。请注意，系统中显示的文件大小为原始文件的大小，不包含转码后生成的代理文件大小。无论图片还是视频，都会额外生成一张 300p 的 WebP 封面图，作为文件列表中的预览图。此外：
>
> * **图片：** 会生成一份与原图分辨率完全一致的高质量 WebP 转码版本，在保证画质的同时提升浏览性能。
> * **视频：** 会根据转码配置生成至少一个代理视频，同时生成雪碧图（Sprite）和一段最长 1600 帧的低分辨率转码视频，用于实现快速拖动时间轴和即时视频预览。

---

## 安装指南

以下是使用本地存储运行 Shumai 的快速上手指南。如需了解高级配置（包括 S3 兼容存储配置、Temporal 工作流编排等），请参阅我们的[官方文档](https://docs.shumai.one/getting-started/overview)。

### 方案一：使用 Docker Compose（推荐）

使用 Docker Compose 是运行 Shumai 最快的方式。您无需克隆仓库，也不需要手动安装依赖包。请确保电脑上已安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)，然后按照以下步骤操作：

1. 创建并进入一个新目录，用于存放配置文件和数据卷：
   ```bash
   mkdir shumai && cd shumai

   ```

2. 下载 `docker-compose.yaml` 配置文件：
   ```bash
   curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose-aliyun.yaml

   ```


3. 配置环境变量（可选）：
* `SHUMAI_SERVER_PORT` 用于控制 Shumai 服务监听的端口，默认值为 `3000`。
* 默认情况下，该 Docker Compose 部署会自动启用集成的本地存储。若想切换至外部 S3 兼容存储，请在 `environment` 中配置 S3 提供商的环境变量。以下是 AWS S3 和 Cloudflare R2 的配置示例：

  **AWS S3 示例：**
  ```yaml
  STORAGE_BACKEND: s3
  S3_BUCKET: your-bucket-name
  S3_ACCESS_KEY_ID: your-access-key-id
  S3_SECRET_ACCESS_KEY: your-secret-access-key
  AWS_ENDPOINT_URL_S3: https://s3.us-east-1.amazonaws.com
  ```

  **Cloudflare R2 示例：**
  ```yaml
  STORAGE_BACKEND: s3
  S3_BUCKET: your-bucket-name
  S3_REGION: auto
  S3_ACCESS_KEY_ID: your-access-key-id
  S3_SECRET_ACCESS_KEY: your-secret-access-key
  AWS_ENDPOINT_URL_S3: https://<account-id>.r2.cloudflarestorage.com
  ```


* 默认情况下 `AWS_ENDPOINT_URL_S3` 指向 `http://localhost:{SHUMAI_SERVER_PORT}`。如果您使用本地存储，但希望在自定义的主机名或端口上公开访问 Shumai，请务必将 `AWS_ENDPOINT_URL_S3` 修改为浏览器访问该服务时所使用的外部 URL。
例如，如果您将 `docker-compose.yaml` 中的端口映射从 `3000:3000` 修改为了 `12345:3000`，且服务部署在 IP 为 `12.34.56.78` 的服务器上，请进行如下设置：
   ```
   AWS_ENDPOINT_URL_S3: http://12.34.56.78:12345

   ```


此地址必须能够从客户端浏览器正常访问，且必须包含对外暴露的实际端口号。


4. 在后台启动所有服务：
   ```bash
   docker compose up -d

   ```


5. 打开浏览器，访问 `http://localhost:3000` 即可开始使用（若是远程部署，请访问 `http://<您的服务器IP>:3000`）。

### 方案二：通过 NPM / 包管理器安装

通过 NPM 上的 `@shumai-one/shumai` 进行安装。

#### 第一步：启动带 pgvector 支持的 PostgreSQL

Shumai 依赖支持 `pgvector` 扩展的 PostgreSQL 数据库。您可以使用 Docker 快速启动一个预配置好的数据库容器：

```bash
docker run --name shumai_postgres \
  -e POSTGRES_USER=shumai \
  -e POSTGRES_PASSWORD=shumai_password \
  -e POSTGRES_DB=shumai_db \
  -p 5432:5432 \
  -d docker.m.daocloud.io/pgvector/pgvector:pg18

```

#### 第二步：创建工作区目录

创建一个专属目录用来存放环境配置和媒体文件（媒体文件默认会保存在 `./data` 目录下）：

```bash
mkdir shumai && cd shumai

```

#### 步骤 3：安装平台依赖

#### Linux

在 Linux 上运行 Shumai 需要安装以下系统依赖：

- **`ffmpeg`** —— 用于媒体转码和元数据提取。
- **`poppler`** (`poppler-utils`) —— 用于 PDF 页面图像提取和 PDF 雪碧图预览生成 (`pdftoppm`)。
- **`imagemagick`** —— 用于 PSD 格式图像转码和 sRGB 色彩空间转换。
- **`bubblewrap`**、**`socat`** 和 **`ripgrep`** —— AI Agent 沙箱（`anthropic-experimental/sandbox-runtime`）所需，用于进程隔离、网络通信和工作区搜索。

可以使用以下命令一次性安装所有依赖：

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
> **Ubuntu 24.04+** 默认限制非特权用户创建 User Namespace，这会导致 `anthropic-experimental/sandbox-runtime` 无法使用 `bubblewrap` 提供沙箱隔离。
>
> 如需临时启用 User Namespace，请执行：
>
> ```bash
> sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
> ```
>
> 或者，配置 AppArmor Profile，为相关可执行文件授予所需的 `userns` 权限。

---

#### macOS

在 macOS 上运行 Shumai 需要：

- **`ffmpeg`** —— 用于媒体转码和元数据提取。
- **`poppler`** —— 用于 PDF 页面图像提取和 PDF 雪碧图预览生成 (`pdftoppm`)。
- **`imagemagick`** —— 用于 PSD 格式图像转码和 sRGB 色彩空间转换。
- **`ripgrep`** —— AI Agent 沙箱（`anthropic-experimental/sandbox-runtime`）所需。

使用 Homebrew 安装所需依赖：

```bash
brew install ffmpeg poppler imagemagick ripgrep
```

---

#### Windows（Alpha）

> [!WARNING]
> anthropic-experimental/sandbox-runtime 的 Windows 支持目前仍处于 **Alpha** 阶段，整体设计仍在持续调整中。
>
> 当前实现提供了以下能力：
> - 通过 **Windows Filtering Platform (WFP)** 实现网络出口（egress）过滤。
> - 通过 **ACL Stamping** 实现文件读写权限限制。
>
> **但这并不能作为针对恶意沙箱进程的安全边界（security boundary）**。
>
> 未来版本将对沙箱机制进行重大调整，届时沙箱进程将运行在独立的沙箱用户账户下。

在 Windows 上运行 Shumai 需要：

- **`ffmpeg`** —— 用于媒体转码和元数据提取。
- **`imagemagick`** —— 用于 PSD 格式图像转码和 sRGB 色彩空间转换。

使用你偏好的包管理器安装所需依赖：

**winget**
```powershell
winget install Gyan.FFmpeg ImageMagick.ImageMagick
```

**Chocolatey**
```powershell
choco install ffmpeg imagemagick
```

#### 第四步：全局安装 Shumai

使用您常用的包管理器进行全局安装：

```bash
# 使用 NPM
npm install -g @shumai-one/shumai

# 使用 PNPM
pnpm add -g @shumai-one/shumai

# 使用 Bun
bun add -g @shumai-one/shumai

```

#### 第五步：配置环境配置

在刚才创建的工作区目录（`shumai/`）下新建一个 `.env` 文件，并填入以下配置：

```env
DATABASE_URL=postgresql://shumai:shumai_password@localhost:5432/shumai_db?schema=public
BETTER_AUTH_SECRET=ySxs7DxzHDZBbeeHNPEwBuspYwipBqz5Gk5XdBjNhWw=
STORAGE_BACKEND=local
SHUMAI_SERVER_PORT=3000
AWS_ENDPOINT_URL_S3=http://localhost:3000

```

> [!NOTE]
> `SHUMAI_SERVER_PORT` 用于设置 Web 服务的启动端口，而 `AWS_ENDPOINT_URL_S3` 供浏览器端构建文件上传链接。
> 如果您部署在远程服务器（如 `http://123.456.7.8`）并且做了端口映射（如 Docker 中的 `12345:3000`），请将 `AWS_ENDPOINT_URL_S3` 设置为 `http://123.456.7.8:12345`。

#### 第六步：启动 Shumai

> [!IMPORTANT]
> **Bun 用户特别提示：** 由于发布的包二进制文件包含 `#!/usr/bin/env node` 头部声明（Shebang），直接在终端执行全局命令（例如 `shumai`）默认会通过 Node.js 运行。如果您是用 Bun 安装的并且希望调用 Bun 运行时，请在所有命令前加上 `bun run --bun` 前缀（例如：`bun run --bun shumai`、`bun run --bun shumai -d`、`bun run --bun shumai stop`）。

在您的工作区目录下执行以下命令启动应用：

```bash
shumai

```

您也可以让 Shumai 在后台以守护进程（Daemon）模式运行和管理：

* **后台模式启动**：
```bash
shumai -d

```


* **停止服务**：
```bash
shumai stop

```


* **重启服务**：
```bash
shumai restart

```


* **查看并跟踪实时日志**：
```bash
shumai logs

```



启动时，Shumai 会自动执行数据库迁移（Migration）并在 `http://localhost:3000` 拉起 Web 服务。

---

### 方案三：源码编译运行（开发环境）

如果您希望在本地参与 Shumai 的开发，请按以下步骤配置开发环境：

1. 克隆代码仓库并安装依赖项：
```bash
git clone [https://github.com/shumaiOne/shumai.git](https://github.com/shumaiOne/shumai.git)
cd shumai
bun install

```


2. 启动 `pgvector` 数据库容器（参考**方案二中的第一步**）。
3. 参照**方案二中的第五步**，在项目根目录下创建一个 `.env` 文件。
4. 执行数据库结构迁移：
```bash
bun run db:migrate

```


5. 启动本地开发服务器：
```bash
bun run dev

```



---

## 命令行工具 (CLI)

Shumai 自带一个功能完备的命令行工具（CLI），支持您直接在终端里高效管理项目、文件夹、资产，批量上传文件/目录，以及快速创建新版本。

关于 CLI 的安装与详细使用指南，请参阅 [CLI Readme](https://www.google.com/search?q=apps/cli/README.md)。
