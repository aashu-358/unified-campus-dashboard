import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { gateway } from "@/lib/mcpClient";
import { writeLog } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const { message, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        function send(event: string, data: any) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }

        try {
          await gateway.initialize();
          const allTools = await gateway.getAllTools();

          // ----------------------------------------------------
          // FALLBACK LOCAL ROUTER (if GEMINI_API_KEY is missing)
          // ----------------------------------------------------
          if (!apiKey) {
            writeLog("WARN", "ChatRoute", "GEMINI_API_KEY not found. Running in Offline Mock AI mode.");
            send("text", "> **Note**: Running in offline mock AI mode because `GEMINI_API_KEY` is not set. Querying MCP servers using a keyword routing engine.\n\n");

            const queryLower = message.toLowerCase();
            let matched = false;

            // 1. Library MCP Routing
            if (queryLower.includes("book") || queryLower.includes("library") || queryLower.includes("clean code") || queryLower.includes("reserve")) {
              matched = true;
              if (queryLower.includes("reserve")) {
                send("tool-start", { serverId: "library", toolName: "reserve_book", args: { isbn: "978-0132350884", studentId: "stud-999" } });
                const res = await gateway.executeTool("library", "reserve_book", { isbn: "978-0132350884", studentId: "stud-999" });
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "library", toolName: "reserve_book", result: resJson });
                send("text", `I've connected to the Library MCP Server and successfully reserved the book for you:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              } else {
                send("tool-start", { serverId: "library", toolName: "search_books", args: { query: "Code" } });
                const res = await gateway.executeTool("library", "search_books", { query: "Code" });
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "library", toolName: "search_books", result: resJson });
                send("text", `Here are the matching books found in the library:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              }
            }

            // 2. Cafeteria MCP Routing
            if (queryLower.includes("cafeteria") || queryLower.includes("lunch") || queryLower.includes("menu") || queryLower.includes("food") || queryLower.includes("eat")) {
              matched = true;
              send("tool-start", { serverId: "cafeteria", toolName: "get_menu", args: { cafeteriaId: "main-dining-hall", day: "Monday" } });
              const res = await gateway.executeTool("cafeteria", "get_menu", { cafeteriaId: "main-dining-hall", day: "Monday" });
              const menuJson = JSON.parse(res.content[0].text);
              send("tool-end", { serverId: "cafeteria", toolName: "get_menu", result: menuJson });

              send("tool-start", { serverId: "cafeteria", toolName: "get_wait_time", args: { cafeteriaId: "main-dining-hall" } });
              const waitRes = await gateway.executeTool("cafeteria", "get_wait_time", { cafeteriaId: "main-dining-hall" });
              const waitJson = JSON.parse(waitRes.content[0].text);
              send("tool-end", { serverId: "cafeteria", toolName: "get_wait_time", result: waitJson });

              send("text", `Here is today's menu at the Main Dining Hall:\n\n\`\`\`json\n${JSON.stringify(menuJson.menu || menuJson, null, 2)}\n\`\`\`\n\n* **Crowd Status**: ${waitJson.busyStatus}\n* **Est. Wait Time**: ${waitJson.waitTimeMinutes} minutes`);
            }

            // 3. Events MCP Routing
            if (queryLower.includes("event") || queryLower.includes("hackathon") || queryLower.includes("tech fest") || queryLower.includes("register")) {
              matched = true;
              if (queryLower.includes("register") && queryLower.includes("hackathon")) {
                send("tool-start", { serverId: "events", toolName: "register_event", args: { eventId: "ev-101", studentId: "stud-999" } });
                const res = await gateway.executeTool("events", "register_event", { eventId: "ev-101", studentId: "stud-999" });
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "events", toolName: "register_event", result: resJson });
                send("text", `I have registered you for the hackathon:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              } else {
                send("tool-start", { serverId: "events", toolName: "get_upcoming_events", args: {} });
                const res = await gateway.executeTool("events", "get_upcoming_events", {});
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "events", toolName: "get_upcoming_events", result: resJson });
                send("text", `Here are the upcoming campus events:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              }
            }

            // 4. Academics MCP Routing
            if (queryLower.includes("course") || queryLower.includes("professor") || queryLower.includes("office hours") || queryLower.includes("exam") || queryLower.includes("cs") || queryLower.includes("turing")) {
              matched = true;
              if (queryLower.includes("professor") || queryLower.includes("office hours") || queryLower.includes("turing")) {
                send("tool-start", { serverId: "academics", toolName: "get_professor_hours", args: { name: "Turing" } });
                const res = await gateway.executeTool("academics", "get_professor_hours", { name: "Turing" });
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "academics", toolName: "get_professor_hours", result: resJson });
                send("text", `Here are the details for Dr. Turing:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              } else if (queryLower.includes("exam")) {
                send("tool-start", { serverId: "academics", toolName: "get_exam_schedule", args: { courseCode: "CS-101" } });
                const res = await gateway.executeTool("academics", "get_exam_schedule", { courseCode: "CS-101" });
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "academics", toolName: "get_exam_schedule", result: resJson });
                send("text", `Here is the exam schedule for CS-101:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              } else {
                send("tool-start", { serverId: "academics", toolName: "search_courses", args: { query: "CS" } });
                const res = await gateway.executeTool("academics", "search_courses", { query: "CS" });
                const resJson = JSON.parse(res.content[0].text);
                send("tool-end", { serverId: "academics", toolName: "search_courses", result: resJson });
                send("text", `Here are the matching courses found:\n\n\`\`\`json\n${JSON.stringify(resJson, null, 2)}\n\`\`\``);
              }
            }

            if (!matched) {
              send("text", "I'm not sure which campus service to query for that. Try asking about the library books, the lunch menu, upcoming events, or course professor office hours!");
            }
            controller.close();
            return;
          }

          // ----------------------------------------------------
          // DYNAMIC GEMINI ROUTER (using Function Calling)
          // ----------------------------------------------------
          const genAI = new GoogleGenerativeAI(apiKey);

          // Map MCP tools to Gemini declarations
          const functionDeclarations = allTools.map((t: any) => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          }));

          const toolsConfig = functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined;

          const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
          const model = genAI.getGenerativeModel({
            model: modelName,
            tools: toolsConfig,
          });

          // Format conversation history
          const formattedHistory = (history || []).map((msg: any) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));

          const chat = model.startChat({
            history: formattedHistory,
          });

          async function executeQueryAndStream(queryText: string | any[]) {
            const result = await chat.sendMessageStream(queryText);
            const pendingCalls: any[] = [];

            for await (const chunk of result.stream) {
              const calls = typeof chunk.functionCalls === "function" ? chunk.functionCalls() : (chunk.functionCalls as any);
              if (calls && calls.length > 0) {
                pendingCalls.push(...calls);
              } else {
                const text = typeof chunk.text === "function" ? chunk.text() : (chunk.text as any);
                if (text) {
                  send("text", text);
                }
              }
            }

            // If Gemini returned function calls, resolve them and run recursively
            if (pendingCalls.length > 0) {
              const responses: any[] = [];

              for (const call of pendingCalls) {
                const { name, args } = call;
                const toolInfo = allTools.find((t: any) => t.name === name);
                const serverId = toolInfo ? toolInfo.serverId : "unknown";

                send("tool-start", { serverId, toolName: name, args });

                let resultData;
                try {
                  const mcpResponse = await gateway.executeTool(serverId, name, args);
                  resultData = JSON.parse(mcpResponse.content[0].text);
                } catch (err: any) {
                  resultData = { error: err.message || "Failed to execute tool on server" };
                }

                send("tool-end", { serverId, toolName: name, result: resultData });

                responses.push({
                  functionResponse: {
                    name,
                    response: { result: resultData },
                  },
                });
              }

              // Recursively feed the function responses back into Gemini
              await executeQueryAndStream(responses);
            }
          }

          await executeQueryAndStream(message);
          controller.close();
        } catch (err: any) {
          writeLog("ERROR", "ChatRoute", `Streaming error: ${err.message}`);
          send("error", err.message || "Unknown error in stream");
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    writeLog("ERROR", "ChatRoute", `Route error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
