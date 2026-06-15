import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

const DATA_PATH = path.resolve("src/data/events.json");

function readData() {
  try {
    const content = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading events data:", err);
    return [];
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing events data:", err);
  }
}

const server = new Server(
  {
    name: "events-mcp-server",
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
        name: "get_upcoming_events",
        description: "Fetch upcoming events on campus. Filter by category (e.g., 'Technology', 'Sports', 'Social', 'Career').",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional category to filter events",
            },
          },
        },
      },
      {
        name: "register_event",
        description: "Register a student for a specific campus event using the event ID.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The ID of the event (e.g., 'ev-101')",
            },
            studentId: {
              type: "string",
              description: "The student ID registering for the event (e.g., 'stud-101')",
            },
          },
          required: ["eventId", "studentId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const events = readData();

  if (name === "get_upcoming_events") {
    const { category } = args;
    if (category) {
      const filtered = events.filter(e => e.category.toLowerCase() === category.toLowerCase());
      return {
        content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
    };
  }

  if (name === "register_event") {
    const { eventId, studentId } = args;
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Event with ID '${eventId}' not found.` }) }],
      };
    }

    const event = events[eventIndex];
    if (event.rsvps.includes(studentId)) {
      return {
        content: [{ type: "text", text: JSON.stringify({ message: `Student '${studentId}' is already registered for this event.` }) }],
      };
    }

    event.rsvps.push(studentId);
    events[eventIndex] = event;
    writeData(events);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Successfully registered for event '${event.title}'.`,
            event,
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Events MCP Server running on stdio");
