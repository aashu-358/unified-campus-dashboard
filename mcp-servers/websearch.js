import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("src/data/iitr_sources.json");

function readSources() {
  try {
    const content = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading IITR sources data:", err);
    return [];
  }
}

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
        name: "get_iitr_sources",
        description: "Retrieve a list of verified IIT Roorkee websites and official Instagram handles for major fests (Sangram, Thomso, Cognizance) and technical/cultural groups (SDSLabs, IMG, PAG, MDG, InfoSec).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "search_iitr_source",
        description: "Conduct a targeted web search on the official website or Instagram feed of a specific IIT Roorkee fest or group. Bypasses social login barriers using search crawler indexing.",
        inputSchema: {
          type: "object",
          properties: {
            sourceId: {
              type: "string",
              description: "The ID of the source (e.g., 'sangram', 'sdslabs', 'thomso', 'cognizance', 'img', 'mdg', 'pag', 'infosec')",
            },
            query: {
              type: "string",
              description: "Optional query keyword (e.g., 'sports', 'dates', 'workshop')",
            },
          },
          required: ["sourceId"],
        },
      },
      {
        name: "web_search",
        description: "Perform a general web search for real-time information regarding IIT Roorkee or general queries.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query (e.g., 'Sangram IIT Roorkee')",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

async function runDuckDuckGoSearch(searchQuery) {
  try {
    console.error(`Executing Web Search on DuckDuckGo for: "${searchQuery}"`);
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
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

    return results.slice(0, 5); // Return top 5 results
  } catch (err) {
    console.error(`DuckDuckGo search failed: ${err.message}`);
    throw err;
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const sources = readSources();

  if (name === "get_iitr_sources") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(sources, null, 2),
        },
      ],
    };
  }

  if (name === "search_iitr_source") {
    const { sourceId, query } = args;
    const source = sources.find(s => s.id === sourceId);

    if (!source) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Source ID '${sourceId}' not found.` }) }],
      };
    }

    let searchQuery = "";
    // If the target is Instagram and we want to query posts/bio
    if (source.instagram) {
      try {
        const handle = source.instagram.split("instagram.com/")[1];
        searchQuery = `site:instagram.com/${handle}`;
        if (query) {
          searchQuery += ` "${query}"`;
        }
      } catch (e) {
        // Fallback to website search
        const domain = new URL(source.website).hostname;
        searchQuery = `site:${domain}`;
        if (query) searchQuery += ` ${query}`;
      }
    } else {
      const domain = new URL(source.website).hostname;
      searchQuery = `site:${domain}`;
      if (query) searchQuery += ` ${query}`;
    }

    try {
      const searchResults = await runDuckDuckGoSearch(searchQuery);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              sourceName: source.name,
              targetQuery: searchQuery,
              results: searchResults.length > 0 ? searchResults : "No indexed pages found for this query on the source feed."
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Failed to scrape source feed: ${err.message}` }),
          },
        ],
      };
    }
  }

  if (name === "web_search") {
    const { query } = args;
    if (!query) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Query is required" }) }],
      };
    }

    try {
      const searchResults = await runDuckDuckGoSearch(query);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(searchResults, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Search failed: ${err.message}` }),
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
