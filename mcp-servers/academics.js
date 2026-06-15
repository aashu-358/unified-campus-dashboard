import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import Fuse from "fuse.js";

const DATA_PATH = path.resolve("src/data/courses.json");

function readData() {
  try {
    const content = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading academics data:", err);
    return { courses: [], professors: [], exams: [] };
  }
}

const server = new Server(
  {
    name: "academics-mcp-server",
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
        name: "search_courses",
        description: "Search for academic courses using keywords in course name, code, department, or syllabus. Supports fuzzy matching.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query (e.g., 'CS-101', 'physics', 'relational database')",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_professor_hours",
        description: "Retrieve a professor's office location, contact email, and office hours by name.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the professor (or part of it)",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "get_exam_schedule",
        description: "Retrieve date, time, and room details for the final exam of a specific course code.",
        inputSchema: {
          type: "object",
          properties: {
            courseCode: {
              type: "string",
              description: "The course code (e.g., 'CS-101', 'MATH-205')",
            },
          },
          required: ["courseCode"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const data = readData();

  if (name === "search_courses") {
    const { query } = args;
    const fuse = new Fuse(data.courses, {
      keys: ["code", "name", "department", "syllabus"],
      threshold: 0.4,
    });
    const results = fuse.search(query).map(r => r.item);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results.length > 0 ? results : { message: "No courses found matching query." }, null, 2),
        },
      ],
    };
  }

  if (name === "get_professor_hours") {
    const { name: profName } = args;
    const fuse = new Fuse(data.professors, {
      keys: ["name"],
      threshold: 0.4,
    });
    const results = fuse.search(profName).map(r => r.item);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results.length > 0 ? results : { message: "Professor not found." }, null, 2),
        },
      ],
    };
  }

  if (name === "get_exam_schedule") {
    const { courseCode } = args;
    const exam = data.exams.find(e => e.courseCode.toLowerCase() === courseCode.toLowerCase());
    if (!exam) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Exam schedule not found for course '${courseCode}'.` }) }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(exam, null, 2) }],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Academics MCP Server running on stdio");
