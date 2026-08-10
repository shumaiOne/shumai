/**
 * In-process MCP test server for integration tests.
 *
 * Spins up a real Streamable HTTP MCP server on an ephemeral port using
 * `@modelcontextprotocol/server` (v2, stateless mode) and serves it over
 * Bun's web-standard fetch. Tests connect to it through the real MCP client
 * stack (`@modelcontextprotocol/client` v2), so connection lifecycle, tool
 * discovery, argument validation, and call round-trips are all exercised for
 * real — no mocks.
 */

import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import { z, type ZodRawShape } from 'zod'

export interface TestMcpToolDef {
  name: string
  description?: string
  inputSchema?: ZodRawShape
  handler: (args: Record<string, unknown>) => Promise<unknown>
  /** When set, the tool returns an isError result with this text. */
  errorText?: string
}

export interface TestMcpServerOptions {
  tools: TestMcpToolDef[]
  /** If set, respond with 401 to any request that lacks this bearer token. */
  bearerToken?: string
  /** Port to bind; defaults to an ephemeral port. */
  port?: number
  /** Override the server's self-reported identity (getServerVersion result). */
  serverInfo?: { name: string; title?: string; description?: string }
}

export interface RunningTestMcpServer {
  url: string
  port: number
  stop(): Promise<void>
  /** Requests received, in order, with their headers. */
  requests: Array<{ url: string; headers: Record<string, string> }>
}

export async function startTestMcpServer(
  options: TestMcpServerOptions,
): Promise<RunningTestMcpServer> {
  const server = new McpServer({
    name: 'test-mcp-server',
    version: '1.0.0',
    ...options.serverInfo,
  })
  // registerTool has overloads with incompatible zod type resolutions; bind a
  // narrow local signature so tool registration stays type-safe and simple.
  const registerTool = server.registerTool.bind(server) as unknown as (
    name: string,
    config: { description?: string; inputSchema?: ZodRawShape },
    cb: (args: Record<string, unknown>) => Promise<unknown> | unknown,
  ) => unknown
  for (const tool of options.tools) {
    registerTool(
      tool.name,
      {
        description: tool.description ?? `Test tool ${tool.name}`,
        inputSchema: tool.inputSchema ?? {},
      },
      async (args) => {
        if (tool.errorText) {
          return {
            content: [{ type: 'text', text: tool.errorText }],
            isError: true,
          }
        }
        const result = await tool.handler(args as Record<string, unknown>)
        if (typeof result === 'string') {
          return { content: [{ type: 'text', text: result }] }
        }
        if (
          result &&
          typeof result === 'object' &&
          'structuredContent' in (result as Record<string, unknown>)
        ) {
          const structuredContent = (result as Record<string, unknown>).structuredContent
          return {
            content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
            structuredContent,
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(result) }] }
      },
    )
  }

  // Stateless mode: one transport instance, no session IDs.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  await server.connect(transport)

  const requests: RunningTestMcpServer['requests'] = []

  const httpServer = Bun.serve({
    port: options.port ?? 0,
    idleTimeout: 30,
    async fetch(req) {
      requests.push({
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
      })

      if (options.bearerToken) {
        const auth = req.headers.get('authorization')
        if (auth !== `Bearer ${options.bearerToken}`) {
          return new Response('Unauthorized', { status: 401 })
        }
      }

      const url = new URL(req.url)
      if (url.pathname === '/mcp') {
        return transport.handleRequest(req)
      }
      return new Response('not found', { status: 404 })
    },
  })

  const port = httpServer.port as number
  return {
    url: `http://localhost:${port}/mcp`,
    port,
    requests,
    async stop() {
      await server.close().catch(() => {})
      httpServer.stop(true)
    },
  }
}

/** Common test tools: echo (returns string), add (structured math), list_sims. */
export function standardTestTools(): TestMcpToolDef[] {
  return [
    {
      name: 'echo',
      description: 'Echoes the provided text back',
      inputSchema: { text: z.string() },
      handler: async (args) => `echo:${String(args.text)}`,
    },
    {
      name: 'add',
      description: 'Adds two numbers',
      inputSchema: { a: z.number(), b: z.number() },
      handler: async (args) => ({
        structuredContent: { sum: Number(args.a) + Number(args.b) },
      }),
    },
    {
      name: 'list_sims',
      description: 'Lists simulator devices',
      handler: async () => ['iPhone 15 Pro', 'iPad Pro'],
    },
  ]
}
