<p align="center">
  <img src="docs/logo-rounded.png" alt="Shumai Logo" width="65" />
</p>

<h1 align="center">Shumai</h1>

<p align="center">
  <strong>为创意工作打造的开源协作平台。</strong>
</p>

<p align="center">
  <a href="https://hub.docker.com/r/shumaione/shumai"><img alt="Docker pulls" src="https://img.shields.io/docker/pulls/shumaione/shumai" /></a>
  <a href="https://github.com/shumaiOne/shumai/releases"><img alt="GitHub latest release" src="https://img.shields.io/github/v/release/shumaiOne/shumai" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a target="_blank" href="https://deepwiki.com/shumaiOne/shumai"><img alt="Ask DeepWiki" src="https://deepwiki.com/badge.svg" /></a>
</p>

<p align="center">
  <a target="_blank" href="https://shumai.one/">官方网站</a> | <a target="_blank" href="https://docs.shumai.one/getting-started/overview">文档</a> | <a target="_blank" href="https://staging.shumai.one">在线演示</a> | <a target="_blank" href="README.md">English</a>
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
* **基于转盘渲染服务的 3D 资产预览**：通过集成 [turntable-renderer](https://docs.shumai.one/using-shumai/3d-asset-support) 支持为 GLB、FBX、OBJ、STL、USD 和 DAE 等 3D 模型生成高质量的交互式转盘预览与视频。
* **基于 Gotenberg 的文档 PDF 转码代理**：通过集成 [Gotenberg](https://docs.shumai.one/using-shumai/gotenberg) 支持将 Word、PowerPoint、Excel、Markdown、HTML 和 CSV 文档高质量转换为 PDF 代理文件进行在线预览。
* **语义搜索**：支持按画面内容或概念含义搜索素材，底层基于向量嵌入技术。详见[相关文档](https://docs.shumai.one/using-shumai/semantic-search)。
* **非编剪辑导出与 Premiere 插件（实验性）**：支持将时间戳审阅评论导出至常用非编软件（Premiere Pro XML、DaVinci Resolve EDL、Final Cut Pro、Avid Media Composer），或使用实验性的 Premiere Pro 原生 UXP 插件导入媒体素材并将评论自动同步为时间轴标记。详见[相关文档](https://docs.shumai.one/using-shumai/nle-and-premiere)。

但 Shumai 不仅仅只满足于 Frame.io 的开源替代。随着 GPT-Image-2、Seedance 2.5 这类强大模型的问世，AI已经生成产品级的图片/视频。很多时候，你只要给一句提示词，就能直接生成或修改图片和视频，而不用再打开 Photoshop、Premiere 或者 Houdini。也正因为这样，Shumai 才把 AI Agent 做成了核心能力：

* **Agent 就像团队成员**：你可以在素材评论区里直接用 `@` 提到 AI Agent，像拉一个真实同事进来一起看稿一样。
* **Agent 也能当你的私聊助手**：你可以单独和它聊天，让它帮你查东西、做任务。
* **自定义技能和工具**：你可以给 Agent 接上自己的脚本、工具和自动化能力。
* **Model Context Protocol (MCP) 支持**：通过远程 MCP 服务端为 Agent 接入外部工具与 API，支持 OAuth 鉴权与按 Agent 独立分配访问权限。
* **沙箱隔离执行**：Agent 生成的脚本会在隔离环境里运行，更安全。
* **AI 自动补全元数据**：新素材上传后，系统可以自动帮你补一些元数据。
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
<details>
  
<summary>复制这个提示词，让agent帮你安装</summary>

```
请帮我在本机使用 Docker Compose 一键部署 Shumai。

请严格参考官方文档：
https://gh-proxy.com/https://raw.githubusercontent.com/shumaiOne/shumai/main/README_CN.md

要求：

1. 只能使用 Docker Compose local方式部署，不要使用其他部署方式。
2. 部署前请先检查本机是否已安装并可正常使用 Docker 和 Docker Compose。
3. 如果本机未安装 Docker，请立即提醒用户先安装 Docker，并停止后续部署操作。不要自行安装 Docker，也不要采用其他方式部署。
4. 获取 `docker-compose-aliyun.yaml` 文件内容时，必须通过 `https://gh-proxy.com` 加速访问，不要直接访问 GitHub Raw 地址。
```
</details>

使用 Docker Compose 是运行 Shumai 最快的方式。您无需克隆仓库，也不需要手动安装依赖包。请确保电脑上已安装 [Docker](https://docs.docker.com/get-docker/) 和 [Docker Compose](https://docs.docker.com/compose/install/)，然后按照以下步骤操作：

1. 创建并进入一个新目录，用于存放配置文件和数据卷：
   ```bash
   mkdir shumai && cd shumai

   ```

2. 根据您的需求和机器可用内存，下载对应的 `docker-compose.yaml` 配置文件：

   * **精简版（建议内存：2 GB+）**：包含 Shumai 核心应用与 PostgreSQL 数据库。
     ```bash
     curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose-aliyun.yaml
     ```

   * **含嵌入向量服务版（建议内存：4 GB+）**：新增基于 `shumaiOne/embedding-server` (`EmbeddingGemma 2 740M`) 的本地多模态语义搜索能力。
     ```bash
     curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose-aliyun.embedding.yaml
     ```

   * **完整版（建议内存：8 GB+）**：一站式全功能套件，包含 `embedding-server`、`turntable-renderer`（3D 模型交互转盘预览）与 `Gotenberg`（文档与表格 PDF 代理转码）。
     ```bash
     curl -o docker-compose.yaml https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose-aliyun.full.yaml
     ```

   > [!NOTE]
   > 默认的 Docker Compose 配置使用基于 CPU 的软件转码。如果您的服务器配备了支持的显卡（NVIDIA NVENC、Intel QuickSync、AMD/Intel VA-API 或 Rockchip RKMPP）并需要开启 GPU 硬件加速转码，请参考 [硬件加速转码配置文档](https://docs.shumai.one/configuration/hardware-transcoding)。


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

### 方案二：源码编译运行（开发环境）

如果您希望在本地参与 Shumai 的开发，请按以下步骤配置开发环境：

1. 克隆代码仓库并安装依赖项：
   ```bash
   git clone https://github.com/shumaiOne/shumai.git
   cd shumai
   bun install
   ```

2. 启动 `pgvector` 数据库容器：
   ```bash
   docker run --name shumai_postgres \
     -e POSTGRES_USER=shumai \
     -e POSTGRES_PASSWORD=shumai_password \
     -e POSTGRES_DB=shumai_db \
     -p 5432:5432 \
     -d docker.m.daocloud.io/pgvector/pgvector:pg18
   ```

3. 在项目根目录下创建一个 `.env` 文件，填入以下基础配置：
   ```env
   DATABASE_URL=postgresql://shumai:shumai_password@localhost:5432/shumai_db?schema=public
   BETTER_AUTH_SECRET=ySxs7DxzHDZBbeeHNPEwBuspYwipBqz5Gk5XdBjNhWw=
   STORAGE_BACKEND=local
   SHUMAI_SERVER_PORT=3000
   AWS_ENDPOINT_URL_S3=http://localhost:3000
   ```

4. 生成多语言国际化（i18n）代码：
   ```bash
   bun run i18n:compile
   ```
   > [!TIP]
   > 在前端开发过程中，可以在单独的终端窗口中运行 `bun run i18n:watch`，在修改 `packages/webui/messages/` 下的翻译文案时自动重新编译。

5. 执行数据库结构迁移：
   ```bash
   bun run db:migrate
   ```

6. 启动本地开发服务器：
   ```bash
   bun run dev
   ```

> [!NOTE]
> 如需通过 NPM 或包管理器全局安装运行 Shumai，请参考[官方 NPM 安装指南](https://docs.shumai.one/getting-started/quickstart)。



---

## 命令行工具 (CLI)

Shumai 自带一个功能完备的命令行工具（CLI），支持您直接在终端里高效管理项目、文件夹、资产，批量上传文件/目录，以及快速创建新版本。

关于 CLI 的安装与详细使用指南，请参阅 [CLI Readme](https://www.google.com/search?q=apps/cli/README.md)。
