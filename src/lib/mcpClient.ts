import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeLog } from "./logger";
import path from "path";

interface MCPServerConfig {
  id: string;
  name: string;
  scriptPath: string;
}

const SERVERS: MCPServerConfig[] = [
  { id: "library", name: "Library", scriptPath: "mcp-servers/library.js" },
  { id: "cafeteria", name: "Cafeteria", scriptPath: "mcp-servers/cafeteria.js" },
  { id: "events", name: "Events", scriptPath: "mcp-servers/events.js" },
  { id: "academics", name: "Academics", scriptPath: "mcp-servers/academics.js" },
  { id: "websearch", name: "WebSearch", scriptPath: "mcp-servers/websearch.js" },
];

class MCPGateway {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private statuses: Map<string, { online: boolean; error?: string; tools?: any[] }> = new Map();
  private initializingPromise: Promise<void> | null = null;

  constructor() {
    for (const server of SERVERS) {
      this.statuses.set(server.id, { online: false });
    }
  }

  async initialize() {
    if (this.initializingPromise) return this.initializingPromise;
    this.initializingPromise = this.initAll();
    return this.initializingPromise;
  }

  private async initAll() {
    writeLog("INFO", "MCPGateway", "Initializing connections to MCP servers...");
    
    for (const server of SERVERS) {
      try {
        const fullPath = path.resolve(server.scriptPath);
        writeLog("INFO", "MCPGateway", `Spawning MCP Server '${server.name}' (path: ${fullPath})`);
        
        const transport = new StdioClientTransport({
          command: "node",
          args: [fullPath],
        });

        const client = new Client(
          {
            name: `gateway-${server.id}`,
            version: "1.0.0",
          },
          {
            capabilities: {},
          }
        );

        // Set up connection
        await client.connect(transport);
        
        // Fetch tools to check connection and load schema
        const toolsResult = await client.listTools();
        
        this.transports.set(server.id, transport);
        this.clients.set(server.id, client);
        this.statuses.set(server.id, { 
          online: true, 
          tools: toolsResult.tools 
        });
        
        writeLog("INFO", "MCPGateway", `Successfully connected to MCP Server '${server.name}' with ${toolsResult.tools.length} tools.`);
      } catch (err: any) {
        writeLog("ERROR", "MCPGateway", `Failed to connect to MCP Server '${server.name}': ${err.message}`);
        this.statuses.set(server.id, { 
          online: false, 
          error: err.message || "Unknown initialization error" 
        });
      }
    }
  }

  async executeTool(serverId: string, toolName: string, args: any): Promise<any> {
    await this.initialize();
    const client = this.clients.get(serverId);
    if (!client) {
      writeLog("ERROR", "MCPGateway", `Attempted to run tool '${toolName}' but server '${serverId}' is offline.`);
      throw new Error(`Server '${serverId}' is offline or could not be loaded.`);
    }

    writeLog("INFO", "MCPGateway", `Executing tool '${toolName}' on '${serverId}' with arguments: ${JSON.stringify(args)}`);
    
    try {
      const response = await client.callTool({
        name: toolName,
        arguments: args,
      });
      writeLog("INFO", "MCPGateway", `Execution of '${toolName}' complete. Response size: ${JSON.stringify(response).length} chars`);
      return response;
    } catch (err: any) {
      writeLog("ERROR", "MCPGateway", `Error running tool '${toolName}' on '${serverId}': ${err.message}`);
      throw err;
    }
  }

  async getAllTools() {
    await this.initialize();
    const allTools: any[] = [];
    for (const [serverId, status] of this.statuses.entries()) {
      if (status.online && status.tools) {
        for (const tool of status.tools) {
          allTools.push({
            ...tool,
            serverId, // Bind server context
          });
        }
      }
    }
    return allTools;
  }

  getStatuses() {
    const statusObj: Record<string, any> = {};
    for (const [id, stat] of this.statuses.entries()) {
      statusObj[id] = stat;
    }
    return statusObj;
  }

  async shutdown() {
    writeLog("INFO", "MCPGateway", "Shutting down MCP server connections...");
    for (const [id, client] of this.clients.entries()) {
      try {
        await client.close();
        writeLog("INFO", "MCPGateway", `Closed connection for '${id}'`);
      } catch (e: any) {
        writeLog("WARN", "MCPGateway", `Error closing client '${id}': ${e.message}`);
      }
    }
    this.clients.clear();
    this.transports.clear();
    this.initializingPromise = null;
  }
}

// Global caching for Next.js hot-reloads
const globalForGateway = global as unknown as { gateway?: MCPGateway };

export const gateway = globalForGateway.gateway || new MCPGateway();

if (process.env.NODE_ENV !== "production") {
  globalForGateway.gateway = gateway;
}
