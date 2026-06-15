import http from "http";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load local environment variables if present
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf-8");
  for (const line of envContent.split("\n")) {
    const parts = line.split("=");
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = process.env.PORT || 3001;
const apiKey = process.env.GEMINI_API_KEY;

const SERVERS = [
  { id: "library", path: "mcp-servers/library.js" },
  { id: "cafeteria", path: "mcp-servers/cafeteria.js" },
  { id: "events", path: "mcp-servers/events.js" },
  { id: "academics", path: "mcp-servers/academics.js" },
  { id: "websearch", path: "mcp-servers/websearch.js" },
];

const processes = {};
const toolCache = {};
const logs = [];

function log(level, component, message) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] [${level}] [${component}] ${message}`;
  console.log(msg);
  logs.push(msg);
  if (logs.length > 100) logs.shift();
}

// ----------------------------------------------------
// Spawn and Setup Stdio MCP Subprocesses
// ----------------------------------------------------
function initMCPServers() {
  log("INFO", "GatewayServer", "Initializing MCP Subprocesses...");

  for (const s of SERVERS) {
    try {
      const fullPath = path.resolve(s.path);
      log("INFO", "GatewayServer", `Spawning Node process for: ${fullPath}`);

      const proc = spawn("node", [fullPath]);
      proc.stdout.setEncoding("utf-8");
      proc.stderr.setEncoding("utf-8");

      processes[s.id] = proc;

      // When the server registers online
      proc.stderr.on("data", (data) => {
        if (data.includes("running on stdio")) {
          log("INFO", `${s.id}-stderr`, "Server ready. Querying tools...");
          // Request list of tools
          queryServerTools(s.id);
        } else {
          log("DEBUG", `${s.id}-stderr`, data.trim());
        }
      });

      proc.on("error", (err) => {
        log("ERROR", s.id, `Process error: ${err.message}`);
      });

      proc.on("close", (code) => {
        log("WARN", s.id, `Process closed with code: ${code}`);
      });
    } catch (err) {
      log("ERROR", "GatewayServer", `Failed to spawn ${s.id}: ${err.message}`);
    }
  }
}

// Request tool definitions from an MCP server over stdio JSON-RPC
function queryServerTools(serverId) {
  const proc = processes[serverId];
  if (!proc) return;

  const payload = {
    jsonrpc: "2.0",
    id: `list-${serverId}`,
    method: "tools/list",
    params: {}
  };

  let buffer = "";
  
  const handleData = (data) => {
    buffer += data;
    try {
      const json = JSON.parse(buffer.trim());
      if (json.id === `list-${serverId}` && json.result && json.result.tools) {
        toolCache[serverId] = json.result.tools;
        log("INFO", "GatewayServer", `Loaded ${json.result.tools.length} tools for ${serverId}`);
        proc.stdout.off("data", handleData); // Remove listener
      }
    } catch (e) {
      // Buffer not full yet
    }
  };

  proc.stdout.on("data", handleData);
  proc.stdin.write(JSON.stringify(payload) + "\n");
}

// Execute tool call request over stdio JSON-RPC
async function executeMCPTool(serverId, toolName, args) {
  return new Promise((resolve, reject) => {
    const proc = processes[serverId];
    if (!proc) {
      return reject(new Error(`MCP server ${serverId} is offline.`));
    }

    const reqId = `${toolName}-${Date.now()}`;
    const payload = {
      jsonrpc: "2.0",
      id: reqId,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    let buffer = "";

    const handleOutput = (data) => {
      buffer += data;
      try {
        const json = JSON.parse(buffer.trim());
        if (json.id === reqId) {
          proc.stdout.off("data", handleOutput);
          if (json.error) {
            reject(new Error(json.error.message || "Execution error"));
          } else {
            resolve(json.result);
          }
        }
      } catch (e) {
        // Wait for complete line
      }
    };

    proc.stdout.on("data", handleOutput);
    proc.stdin.write(JSON.stringify(payload) + "\n");
  });
}

// Initialize servers on launch
initMCPServers();

// ----------------------------------------------------
// Standalone HTTP Server Router
// ----------------------------------------------------
const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. Get MCP statuses and logs
  if (req.url === "/api/mcp-status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    const statusData = {};
    for (const s of SERVERS) {
      statusData[s.id] = {
        online: !!processes[s.id],
        tools: toolCache[s.id] || []
      };
    }
    res.end(JSON.stringify({ success: true, statuses: statusData, logs }));
    return;
  }

  // 2. Direct Widget Feeds
  if (req.url === "/api/widgets" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    try {
      const lib = await executeMCPTool("library", "search_books", { query: "Code" })
        .then(r => JSON.parse(r.content[0].text))
        .catch(err => ({ error: err.message }));

      const caf = await executeMCPTool("cafeteria", "get_menu", { cafeteriaId: "rajendra-bhawan", day: "Monday" })
        .then(r => JSON.parse(r.content[0].text))
        .catch(err => ({ error: err.message }));

      const evs = await executeMCPTool("events", "get_upcoming_events", {})
        .then(r => JSON.parse(r.content[0].text))
        .catch(err => ({ error: err.message }));

      const acad = await executeMCPTool("academics", "search_courses", { query: "CSN" })
        .then(r => JSON.parse(r.content[0].text))
        .catch(err => ({ error: err.message }));

      res.end(JSON.stringify({
        success: true,
        data: { library: lib, cafeteria: caf, events: evs, academics: acad }
      }));
    } catch (e) {
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // 3. SSE Chat Orchestrator Endpoint
  if (req.url === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { message, history } = JSON.parse(body);

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });

        const send = (event, data) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        // Offline Fallback Router
        if (!apiKey) {
          send("text", "> **Note**: Running in offline mock AI mode because `GEMINI_API_KEY` is not set.\n\n");
          const q = message.toLowerCase();
          
          if (q.includes("book") || q.includes("library") || q.includes("reserve")) {
            send("tool-start", { serverId: "library", toolName: "search_books", args: { query: "Code" } });
            const r = await executeMCPTool("library", "search_books", { query: "Code" });
            const data = JSON.parse(r.content[0].text);
            send("tool-end", { serverId: "library", toolName: "search_books", result: data });
            send("text", `Found library match:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
          } else if (q.includes("menu") || q.includes("food") || q.includes("lunch")) {
            send("tool-start", { serverId: "cafeteria", toolName: "get_menu", args: { cafeteriaId: "rajendra-bhawan", day: "Monday" } });
            const r = await executeMCPTool("cafeteria", "get_menu", { cafeteriaId: "rajendra-bhawan", day: "Monday" });
            const data = JSON.parse(r.content[0].text);
            send("tool-end", { serverId: "cafeteria", toolName: "get_menu", result: data });
            send("text", `Today's menu at Rajendra Bhawan:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
          } else {
            send("text", "Try asking about library books, mess menu schedules, fests, or courses.");
          }
          res.end();
          return;
        }

        // Live Gemini Orchestration
        const genAI = new GoogleGenerativeAI(apiKey);
        const allTools = [];
        for (const sid of Object.keys(toolCache)) {
          for (const t of toolCache[sid]) {
            allTools.push({ ...t, serverId: sid });
          }
        }

        const functionDeclarations = allTools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }));

        const toolsConfig = functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined;
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName, tools: toolsConfig });
        const chat = model.startChat({
          history: (history || []).map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }))
        });

        async function streamGemini(inputQuery) {
          const result = await chat.sendMessageStream(inputQuery);
          const pendingCalls = [];

          for await (const chunk of result.stream) {
            const calls = typeof chunk.functionCalls === "function" ? chunk.functionCalls() : chunk.functionCalls;
            if (calls && calls.length > 0) {
              pendingCalls.push(...calls);
            } else {
              const txt = typeof chunk.text === "function" ? chunk.text() : chunk.text;
              if (txt) send("text", txt);
            }
          }

          if (pendingCalls.length > 0) {
            const responses = [];
            for (const call of pendingCalls) {
              const { name, args } = call;
              const toolInfo = allTools.find(t => t.name === name);
              const serverId = toolInfo ? toolInfo.serverId : "unknown";

              send("tool-start", { serverId, toolName: name, args });
              try {
                const r = await executeMCPTool(serverId, name, args);
                const data = JSON.parse(r.content[0].text);
                send("tool-end", { serverId, toolName: name, result: data });
                responses.push({ functionResponse: { name, response: { result: data } } });
              } catch (err) {
                send("tool-end", { serverId, toolName: name, result: { error: err.message } });
                responses.push({ functionResponse: { name, response: { result: { error: err.message } } } });
              }
            }
            await streamGemini(responses);
          }
        }

        await streamGemini(message);
        res.end();
      } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify(err.message)}\n\n`);
        res.end();
      }
    });
    return;
  }

  // Not found
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  log("INFO", "GatewayServer", `Standalone Gateway Server listening on port: ${PORT}`);
});
