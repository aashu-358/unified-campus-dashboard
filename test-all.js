import { spawn } from "child_process";
import path from "path";

const servers = [
  { name: "library", path: "mcp-servers/library.js" },
  { name: "cafeteria", path: "mcp-servers/cafeteria.js" },
  { name: "events", path: "mcp-servers/events.js" },
  { name: "academics", path: "mcp-servers/academics.js" },
  { name: "websearch", path: "mcp-servers/websearch.js" },
];

async function testServer(serverInfo) {
  return new Promise((resolve) => {
    console.log(`[Test] Launching ${serverInfo.name} server...`);
    const proc = spawn("node", [path.resolve(serverInfo.path)]);
    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
      try {
        // Parse JSON-RPC packet
        const json = JSON.parse(output.trim());
        if (json.result && json.result.tools) {
          console.log(`✅ [Test] ${serverInfo.name} responded successfully. Exposed tools:`);
          for (const t of json.result.tools) {
            console.log(`   - ${t.name}: ${t.description}`);
          }
          proc.kill();
          resolve(true);
        }
      } catch (e) {
        // Wait for complete JSON line
      }
    });

    proc.stderr.on("data", (data) => {
      const msg = data.toString().trim();
      if (msg.includes("running on stdio")) {
        // Server is ready, write JSON-RPC list tools request to stdin
        const req = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {}
        }) + "\n";
        proc.stdin.write(req);
      }
    });

    proc.on("error", (err) => {
      console.log(`❌ [Test] ${serverInfo.name} failed to spawn: ${err.message}`);
      resolve(false);
    });

    // Set a safety timeout
    setTimeout(() => {
      if (proc.killed) return;
      console.log(`❌ [Test] ${serverInfo.name} timed out waiting for JSON-RPC tools list. Current stdout: "${output}"`);
      proc.kill();
      resolve(false);
    }, 4500);
  });
}

async function runAll() {
  console.log("=================================================");
  console.log("       STARTING MCP SYSTEM INTEGRATION TEST      ");
  console.log("=================================================");
  let allPass = true;
  for (const s of servers) {
    const passed = await testServer(s);
    if (!passed) allPass = false;
    console.log("-------------------------------------------------");
  }

  if (allPass) {
    console.log("🎉 SUCCESS: All MCP Servers are compiled and fully compatible!");
    process.exit(0);
  } else {
    console.log("❌ FAILURE: One or more MCP Servers failed integration validation.");
    process.exit(1);
  }
}

runAll();
