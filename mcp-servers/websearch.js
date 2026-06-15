import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "web-search-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "web_search",
        description: "Search the internet for real-time information regarding IIT Roorkee fests, student groups, placement updates, exam dates, or general knowledge.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query (e.g. 'Thomso IIT Roorkee dates 2026', 'SDSLabs IITR')",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "web_search") {
    const { query } = args;
    if (!query) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Query is required" }) }],
      };
    }

    try {
      console.error(`Executing Web Search on DuckDuckGo for: "${query}"`);
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          signal: AbortSignal.timeout(4000) // 4 seconds timeout
        }
      );

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned status: ${response.status}`);
      }

      const html = await response.text();
      const results = [];

      // Match result blocks in DuckDuckGo HTML results
      const matches = html.match(/<div class="result results_links results_links_deep web-result[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g) || [];

      for (const match of matches) {
        const titleMatch = match.match(/<a class="result__url"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = match.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
        const linkMatch = match.match(/<a class="result__url"\s+href="([\s\S]*?)"/i);

        if (titleMatch) {
          const title = titleMatch[1].replace(/<[^>]*>/g, "").trim();
          const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : "";
          let link = linkMatch ? linkMatch[1] : "";

          // Clean redirect URLs if present
          if (link.includes("uddg=")) {
            try {
              const u = new URL("https://html.duckduckgo.com" + link);
              link = decodeURIComponent(u.searchParams.get("uddg") || "");
            } catch (e) {
              // Keep original link
            }
          }

          results.push({ title, snippet, link });
        }
      }

      const parsedResults = results.slice(0, 5); // Return top 5 results

      if (parsedResults.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(parsedResults, null, 2),
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text", text: JSON.stringify({ message: "No search results found." }) }],
        };
      }
    } catch (err) {
      console.error(`Web search scrape failed: ${err.message}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Failed to fetch search results: ${err.message}` }),
          },
        ],
      };
    }
  }

  throw new Error(`Tool not found: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("WebSearch MCP Server running on stdio");
