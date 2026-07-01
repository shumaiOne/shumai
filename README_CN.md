<p align="center">
  <img src="docs/logo-rounded.png" alt="Shumai Logo" width="65" />
</p>

<h1 align="center">Shumai</h1>

<p align="center">
  <strong>为创意工作打造的开源协作平台。</strong>
</p>

<p align="center">
  <a target="_blank" href="https://shumai.one/">官方网站</a> | <a target="_blank" href="https://docs.shumai.one/introduction">文档</a> | <a target="_blank" href="https://staging.shumai.one">在线演示</a> | <a target="_blank" href="README.md">English</a>
</p>
</p>

![Shumai 应用截图](docs/screenshot.webp)

## 功能特性

- **兼容 S3 与本地存储**：使用本地文件系统或任何兼容 S3 的云存储（AWS S3、Cloudflare R2、阿里云 OSS 等）安全地存储和提供您的创意资产。
- **逐帧批注与评论**：直接在视频和图像资产上使用特定帧的绘图工具和带时间戳的评论，提供精确的反馈。
- **安全分享与合集**：创建安全的公开分享链接和媒体合集，以便与客户和团队进行协作。
- **细粒度访问控制**：使用团队级别和项目级别的基于角色的访问控制来管理访问权限。
- **基于 Temporal 的分布式转码**：将占用大量资源的视频转码任务部署到 Temporal Worker上。
- **自定义资产元数据**：为媒体文件添加可搜索/编辑的自定义元数据字段。

#### Shumai 智能体 (Agent)

- **AI Agent 协作**：通过评论区和 AI 智能体进行交流。
- **自定义技能**：通过添加自定义技能来扩展智能体的能力。
- **隔离的沙箱执行**：在沙箱环境中安全地运行智能体提交的脚本。
- **AI 元数据自动填充**：使用AI为资产自动生填充元数据字段。
- **语义搜索**：基于 Gemini Embedding 2 的图片/视频内容搜索。

> [!NOTE]
> **媒体处理与存储说明：** 在上传媒体文件时，Shumai 会始终保留并存储您的原始文件。对于图片，Shumai 会同时生成一个优化的 webp 预览文件；对于视频文件，系统会根据转码设置生成至少一个预览视频，同时还会生成一张雪碧图（Sprite）和一个时间轴快速预览视频（上限 1600 帧），以实现流畅的音视频时间轴预览。

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
curl -o docker-compose.yaml [https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.yaml](https://raw.githubusercontent.com/shumaiOne/shumai/main/docker-compose/local/docker-compose.yaml)

```


3. 配置环境变量（可选）：
* `SHUMAI_SERVER_PORT` 用于控制 Shumai 服务监听的端口，默认值为 `3000`。
* 默认情况下，该 Docker Compose 部署会自动启用集成的本地存储。若想切换至外部 S3 兼容存储，请将 `AWS_ENDPOINT_URL_S3` 设置为对应云厂商的 Endpoint URL，并根据需要配置相应的 AWS 凭证和存储桶（Bucket）参数：
```
 AWS_ENDPOINT_URL_S3: S3_ENDPOINT_URL
 S3_REGION: S3_REGION
 S3_BUCKET: BUCKET_NAME
 S3_ACCESS_KEY_ID: ID
 S3_SECRET_ACCESS_KEY: KEY

```


* 默认情况下 `AWS_ENDPOINT_URL_S3` 指向 `http://localhost:{SHUMAI_SERVER_PORT}`。如果您使用本地存储，但希望在自定义的主机名或端口上公开访问 Shumai，请务必将 `AWS_ENDPOINT_URL_S3` 修改为浏览器访问该服务时所使用的外部 URL。
例如，如果您将 `docker-compose.yaml` 中的端口映射从 `3000:3000` 修改为了 `12345:3000`，且服务部署在 IP 为 `12.34.56.78` 的服务器上，请进行如下设置：
```
AWS_ENDPOINT_URL_S3: [http://12.34.56.78:12345](http://12.34.56.78:12345)

```


此地址必须能够从客户端浏览器正常访问，且必须包含对外暴露的实际端口号。


4. 在后台启动所有服务：
```bash
docker compose up -d

```


5. 打开浏览器，访问 `http://localhost:3000` 即可开始使用（若是远程部署，请访问 `http://<您的服务器IP>:3000`）。

### 方案二：通过 NPM / 包管理器安装

Shumai 已作为 `@shumai-one/shumai` 发布至 NPM 注册表。此方案支持您在全局或本地项目里运行 Shumai。

#### 第一步：启动带 pgvector 支持的 PostgreSQL

Shumai 依赖支持 `pgvector` 扩展的 PostgreSQL 数据库。您可以使用 Docker 快速启动一个预配置好的数据库容器：

```bash
docker run --name shumai_postgres \
  -e POSTGRES_USER=shumai \
  -e POSTGRES_PASSWORD=shumai_password \
  -e POSTGRES_DB=shumai_db \
  -p 5432:5432 \
  -d pgvector/pgvector:pg18

```

#### 第二步：创建工作区目录

创建一个专属目录用来存放环境配置和媒体文件（媒体文件默认会保存在 `./data` 目录下）：

```bash
mkdir shumai && cd shumai

```

#### 第三步：安装平台特定系统依赖

在安装 Shumai 之前，请确保您的宿主机上已经安装了以下系统依赖项：

| 依赖包 | 功能描述 | Ubuntu/Debian | Fedora | Arch | macOS |
| --- | --- | --- | --- | --- | --- |
| **ffmpeg** | 媒体转码及元数据提取 | `sudo apt install -y ffmpeg` | `sudo dnf install -y ffmpeg` | `sudo pacman -S --noconfirm ffmpeg` | `brew install ffmpeg` |
| **bubblewrap** | 用于安全执行 AI 助手脚本的隔离沙箱环境 | `sudo apt install -y bubblewrap` | `sudo dnf install -y bubblewrap` | `sudo pacman -S --noconfirm bubblewrap` | *无需安装* |
| **socat** | 用于沙箱网络桥接的双向套接字中继 | `sudo apt install -y socat` | `sudo dnf install -y socat` | `sudo pacman -S --noconfirm socat` | `brew install socat` |
| **ripgrep** | 用于工作区安全策略的高效文本搜索工具 | `sudo apt install -y ripgrep` | `sudo dnf install -y ripgrep` | `sudo pacman -S --noconfirm ripgrep` | `brew install ripgrep` |

> [!NOTE]
> **Ubuntu 24.04+ 用户请注意：** 这些系统版本默认限制了非特权用户命名空间（unprivileged user namespaces）。为了让 `bubblewrap` 和沙箱隔离层正常工作，需要关闭此限制：
> ```bash
> sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0
> 
> ```
> 
> 
> 或者，您也可以专门配置一个 AppArmor 配置文件，为相关二进制文件授予用户命名空间创建（`userns`）权限。

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
