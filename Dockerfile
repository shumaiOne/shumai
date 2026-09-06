#syntax=docker/dockerfile:1.7-labs
# Stage 1: Builder
FROM oven/bun:1.4.2 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY --parents packages/*/package.json ./
COPY --parents apps/*/package.json ./
COPY patches/ ./patches/

# Install dependencies (including devDependencies for build tools)
RUN bun install --frozen-lockfile

RUN ls -la packages/transcode/node_modules

# Copy source code
COPY . .

# Compile i18n
RUN bun run i18n:compile

# Build API and Worker
RUN bun run build.ts

# Generate runner-package.json for the runner stage
RUN bun run scripts/extract-runtime-deps.ts

# Stage 2: Runner
FROM oven/bun:1.4.2 AS runner

# Install ffmpeg/ffprobe
COPY --from=mwader/static-ffmpeg:8.1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:8.1 /ffprobe /usr/local/bin/

# Install system dependencies for sandbox runtime and agent
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    man-db \
    curl \
    dnsutils \
    less \
    jq \
    bc \
    unzip \
    rsync \
    ripgrep \
    procps \
    lsof \
    socat \
    ca-certificates \
    bubblewrap \
    gosu \
    poppler-utils \
    imagemagick \
    fonts-noto-cjk \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory and make it owned by the bun user
RUN mkdir -p /app/data && chown -R bun:bun /app

# Switch to the non-root bun user
USER bun
WORKDIR /app

# Install runtime dependencies with exact matching versions extracted from the builder stage
COPY --chown=bun:bun --from=builder /app/runner-package.json ./package.json
RUN bun install

# Copy build artifacts and prisma config
COPY --chown=bun:bun --from=builder /app/dist ./
COPY --chown=bun:bun --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --chown=bun:bun --from=builder /app/prisma.config.ts.prod ./prisma.config.ts

# Expose port (Bun Hono defaults to 3000)
EXPOSE 3000

# Switch back to root at the end so the container runs the entrypoint as root
USER root
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose "bun index.js" as "shumai" CLI command (and alias "shuami")
RUN printf '#!/bin/sh\nexec bun /app/index.js "$@"\n' > /usr/local/bin/shumai \
    && chmod +x /usr/local/bin/shumai \
    && ln -s /usr/local/bin/shumai /usr/local/bin/shuami

ENTRYPOINT ["docker-entrypoint.sh"]

# Default command: run migrations and start API server
CMD ["sh", "-c", "bun prisma migrate deploy && bun index.js"]
