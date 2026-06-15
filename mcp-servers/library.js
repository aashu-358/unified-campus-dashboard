import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import Fuse from "fuse.js";

// Bypass SSL Certificate warnings for university intranet hosts
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DATA_PATH = path.resolve("src/data/library.json");

function readData() {
  try {
    const content = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading library data:", err);
    return [];
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing library data:", err);
  }
}

const server = new Server(
  {
    name: "library-mcp-server",
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
        name: "search_books",
        description: "Search for books in the Mahatma Gandhi Central Library (MGCL) at IIT Roorkee. Queries the live OPAC database and falls back to offline catalog.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'algorithms', 'Clean Code')",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "check_availability",
        description: "Check availability, shelf location, and copy count of a book by ISBN or title in MGCL catalog.",
        inputSchema: {
          type: "object",
          properties: {
            isbn: {
              type: "string",
              description: "The ISBN code of the book",
            },
            title: {
              type: "string",
              description: "The title of the book (use if ISBN is unknown)",
            },
          },
        },
      },
      {
        name: "reserve_book",
        description: "Reserve a book at MGCL for a student. Automatically decrements available copy counts.",
        inputSchema: {
          type: "object",
          properties: {
            isbn: {
              type: "string",
              description: "The ISBN of the book to reserve",
            },
            studentId: {
              type: "string",
              description: "The student ID making the reservation (e.g., 'stud-101')",
            },
          },
          required: ["isbn", "studentId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const books = readData();

  if (name === "search_books") {
    const { query } = args;
    if (!query) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Query is required" }) }],
      };
    }

    // Attempt live scraping of IIT Roorkee MGCL Web OPAC
    try {
      console.error(`Attempting live fetch of IITR OPAC for: "${query}"`);
      const response = await fetch(
        `https://opac.mgcl.iitr.ac.in/cgi-bin/koha/opac-search.pl?q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(3000) } // 3 seconds timeout
      );

      if (response.ok) {
        const html = await response.text();
        const results = [];

        // Match individual catalog rows
        // Standard Koha uses table rows for results with class "result" or td with class "bibliocol"
        const resultBlocks = html.match(/<td\s+class=["']?bibliocol["']?[^>]*>([\s\S]*?)<\/td>/gi) ||
                             html.match(/<div\s+class=["']?biblio-info["']?[^>]*>([\s\S]*?)<\/div>/gi) || [];

        if (resultBlocks.length > 0) {
          for (const block of resultBlocks) {
            // Match title
            const titleMatch = block.match(/<a\s+[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/a>/i);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : null;

            if (!title) continue;

            // Match author
            const authorMatch = block.match(/<span\s+class=["']results_summary\s+author["'][^>]*>([\s\S]*?)<\/span>/i) ||
                                block.match(/by\s*<a\s+[^>]*>([\s\S]*?)<\/a>/i) ||
                                block.match(/<span\s+class="author">([\s\S]*?)<\/span>/i) ||
                                block.match(/by\s+([\s\S]*?)(?:<|$|;|\n)/i);
            const author = authorMatch ? authorMatch[1].replace(/<[^>]*>/g, "").trim() : "Unknown Author";

            // Match Call Number
            const callNoMatch = block.match(/Call number:[\s\S]*?<span\s+class="value">([\s\S]*?)<\/span>/i) ||
                                block.match(/Call number:[\s\S]*?([\d\w.\s]+)/i);
            const callNo = callNoMatch ? callNoMatch[1].replace(/<[^>]*>/g, "").trim() : "MGCL Central Stack";

            // Match Availability
            const available = block.includes("Available") || block.includes("available") || !block.includes("Checked out");

            results.push({
              isbn: "Live Record",
              title,
              author,
              category: "Academics",
              availability: {
                status: available ? "Available" : "Checked Out",
                location: `MGCL Floor 2, Call No: ${callNo}`,
                copyCount: available ? 1 : 0
              },
              source: "MGCL (Live IITR OPAC)"
            });
          }
        }

        if (results.length > 0) {
          console.error(`Live scrape succeeded. Found ${results.length} records.`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(results.slice(0, 10), null, 2),
              },
            ],
          };
        }
      }
    } catch (err) {
      console.error(`Live OPAC scrape failed: ${err.message}. Cascading to local catalog.`);
    }

    // Fallback: Fuzzy search in local library.json database
    const fuse = new Fuse(books, {
      keys: ["title", "author", "category"],
      threshold: 0.4,
    });
    const localResults = fuse.search(query).map(r => ({
      ...r.item,
      source: "MGCL (Offline Fallback)"
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(localResults.length > 0 ? localResults : { message: "No books found matching query in offline catalog." }, null, 2),
        },
      ],
    };
  }

  if (name === "check_availability") {
    const { isbn, title } = args;
    if (!isbn && !title) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Either isbn or title is required" }) }],
      };
    }

    if (title) {
      try {
        console.error(`Checking live availability on IITR OPAC for: "${title}"`);
        const response = await fetch(
          `https://opac.mgcl.iitr.ac.in/cgi-bin/koha/opac-search.pl?q=${encodeURIComponent(title)}`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (response.ok) {
          const html = await response.text();
          const titleRegex = new RegExp(`<a\\s+[^>]*class=["']title["'][^>]*>([\\s\\S]*?${title}[\\s\\S]*?)</a>`, "i");
          const titleMatch = html.match(titleRegex);

          if (titleMatch) {
            const actualTitle = titleMatch[1].replace(/<[^>]*>/g, "").trim();
            const available = html.includes("Available") || !html.includes("Checked out");
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    title: actualTitle,
                    author: "MGCL Registered Author",
                    isbn: "Live OPAC Match",
                    availability: {
                      status: available ? "Available" : "Checked Out",
                      location: "Mahatma Gandhi Central Library Stack",
                      copyCount: available ? 1 : 0
                    },
                    source: "MGCL (Live IITR OPAC)"
                  }, null, 2),
                }
              ]
            };
          }
        }
      } catch (err) {
        console.error(`Live availability check failed: ${err.message}. Cascading to local check.`);
      }
    }

    // Fallback check
    let book = null;
    if (isbn) {
      book = books.find(b => b.isbn === isbn);
    } else if (title) {
      const fuse = new Fuse(books, { keys: ["title"], threshold: 0.4 });
      const results = fuse.search(title);
      if (results.length > 0) book = results[0].item;
    }

    if (!book) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Book not found in local catalog." }) }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            availability: book.availability,
            source: "MGCL (Offline Fallback)"
          }, null, 2),
        },
      ],
    };
  }

  if (name === "reserve_book") {
    const { isbn, studentId } = args;
    const books = readData();
    const bookIndex = books.findIndex(b => b.isbn === isbn);

    if (bookIndex === -1) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Book not found in database catalog." }) }],
      };
    }

    const book = books[bookIndex];
    if (book.availability.status !== "Available" || book.availability.copyCount <= 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Book is currently out of stock or checked out." }),
          },
        ],
      };
    }

    // Decrement copies
    book.availability.copyCount -= 1;
    if (book.availability.copyCount === 0) {
      book.availability.status = "Checked Out";
    }
    book.reservations.push({
      studentId,
      date: new Date().toISOString().split("T")[0],
    });

    books[bookIndex] = book;
    writeData(books);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Book '${book.title}' reserved successfully at MGCL for Student ID '${studentId}'.`,
            availability: book.availability,
            source: "MGCL (Local Reservation System)"
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Library MCP Server running on stdio");
