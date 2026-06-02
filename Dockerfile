# Stage 1: Builder
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY --parents packages/*/package.json ./

# Install dependencies (including devDependencies for build tools)
RUN bun install --frozen-lockfile

RUN ls -la packages/transcode/node_modules

# Copy source code
COPY . .

# Build API and Worker
RUN bun run build.ts

# Stage 2: Runner
FROM oven/bun:1 AS runner

WORKDIR /app

# Install ffmpeg/ffprobe
COPY --from=mwader/static-ffmpeg:8.1 /ffmpeg /usr/local/bin/
COPY --from=mwader/static-ffmpeg:8.1 /ffprobe /usr/local/bin/

# Install system dependencies for sandbox runtime
RUN apt-get update && apt-get install -y ripgrep bubblewrap socat && rm -rf /var/lib/apt/lists/*

# Copy sharp/img from builder (they are native and already installed)
# COPY --from=builder /app/packages/transcode/node_modules/sharp ./node_modules/sharp
# COPY --from=builder /app/packages/transcode/node_modules/@img ./node_modules/@img

# Manually install temporalio packages and prisma
# These need native bindings or CLI access in the runner environment
RUN bun add @temporalio/activity @temporalio/client @temporalio/worker @temporalio/workflow && \
    bun add --dev --omit peer prisma sharp

# Copy build artifacts and prisma config
COPY --from=builder /app/dist ./
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/prisma.config.ts.prod ./prisma.config.ts

# Expose port (Bun Hono defaults to 3000)
EXPOSE 3000

# Default command: run migrations and start API server
# Can be overridden to run workers: bun worker-cli.js [domain]
CMD ["sh", "-c", "bun prisma migrate deploy && bun api/src/index.js serve"]
