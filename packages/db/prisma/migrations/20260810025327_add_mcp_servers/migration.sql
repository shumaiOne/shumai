-- CreateEnum
CREATE TYPE "McpTransport" AS ENUM ('streamable_http', 'sse');

-- CreateTable
CREATE TABLE "mcp_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "transport" "McpTransport" NOT NULL DEFAULT 'streamable_http',
    "authConfig" JSONB DEFAULT '{}',
    "config" JSONB DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "permission" "TeamMemberRole" NOT NULL DEFAULT 'reviewer',
    "tools" JSONB DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'not_connected',
    "last_error" TEXT,
    "last_connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_mcp_servers" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "mcp_server_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_server_credentials" (
    "id" TEXT NOT NULL,
    "server_id" TEXT NOT NULL,
    "server_url" TEXT NOT NULL,
    "tokens" JSONB,
    "clientInfo" JSONB,
    "code_verifier" TEXT,
    "oauth_state" TEXT,
    "pending_auth" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_server_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_servers_team_id_name_key" ON "mcp_servers"("team_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_mcp_servers_agent_id_mcp_server_id_key" ON "agent_mcp_servers"("agent_id", "mcp_server_id");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_credentials_server_id_key" ON "mcp_server_credentials"("server_id");

-- AddForeignKey
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_mcp_servers" ADD CONSTRAINT "agent_mcp_servers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_mcp_servers" ADD CONSTRAINT "agent_mcp_servers_mcp_server_id_fkey" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_server_credentials" ADD CONSTRAINT "mcp_server_credentials_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
