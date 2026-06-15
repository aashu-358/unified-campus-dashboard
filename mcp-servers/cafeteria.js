import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("src/data/cafeteria.json");

function readData() {
  try {
    const content = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading cafeteria data:", err);
    return [];
  }
}

const server = new Server(
  {
    name: "cafeteria-mcp-server",
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
        name: "get_menu",
        description: "Retrieve cafeteria menu details by location (e.g., 'main-dining-hall', 'science-cafe'), day (e.g., 'Monday', 'Tuesday'), and optional meal ('breakfast', 'lunch', 'dinner').",
        inputSchema: {
          type: "object",
          properties: {
            cafeteriaId: {
              type: "string",
              description: "The ID of the cafeteria ('main-dining-hall' or 'science-cafe')",
            },
            day: {
              type: "string",
              description: "Day of the week (e.g., 'Monday')",
            },
            meal: {
              type: "string",
              description: "Optional meal type ('breakfast', 'lunch', 'dinner')",
            },
          },
          required: ["cafeteriaId", "day"],
        },
      },
      {
        name: "get_wait_time",
        description: "Get real-time crowd level, estimated checkout wait times, and location details for a cafeteria.",
        inputSchema: {
          type: "object",
          properties: {
            cafeteriaId: {
              type: "string",
              description: "The ID of the cafeteria ('main-dining-hall' or 'science-cafe')",
            },
          },
          required: ["cafeteriaId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const cafes = readData();

  if (name === "get_menu") {
    const { cafeteriaId, day, meal } = args;
    const cafe = cafes.find(c => c.cafeteriaId === cafeteriaId);
    if (!cafe) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Cafeteria '${cafeteriaId}' not found.` }) }],
      };
    }

    const dayMenu = cafe.menu[day];
    if (!dayMenu) {
      return {
        content: [{ type: "text", text: JSON.stringify({ message: `No menu available for ${day} at ${cafe.name}.` }) }],
      };
    }

    if (meal) {
      const items = dayMenu[meal.toLowerCase()] || [];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              cafeteria: cafe.name,
              day,
              meal,
              items,
            }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            cafeteria: cafe.name,
            day,
            menu: dayMenu,
          }, null, 2),
        },
      ],
    };
  }

  if (name === "get_wait_time") {
    const { cafeteriaId } = args;
    const cafe = cafes.find(c => c.cafeteriaId === cafeteriaId);
    if (!cafe) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Cafeteria '${cafeteriaId}' not found.` }) }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            cafeteria: cafe.name,
            location: cafe.location,
            busyStatus: cafe.busyStatus,
            waitTimeMinutes: cafe.waitTimeMinutes,
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Cafeteria MCP Server running on stdio");
