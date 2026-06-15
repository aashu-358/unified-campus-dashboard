import { NextResponse } from "next/server";
import { gateway } from "@/lib/mcpClient";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await gateway.initialize();

    // Query each server in parallel, handling failures individually to prevent one crash from taking down the widgets
    const libraryDataPromise = gateway.executeTool("library", "search_books", { query: "Code" })
      .then(res => JSON.parse((res as any).content[0].text))
      .catch(err => ({ error: err.message || "Failed to load library books" }));

    const cafeteriaDataPromise = gateway.executeTool("cafeteria", "get_menu", { cafeteriaId: "main-dining-hall", day: "Monday" })
      .then(res => JSON.parse((res as any).content[0].text))
      .catch(err => ({ error: err.message || "Failed to load cafeteria menu" }));

    const eventsDataPromise = gateway.executeTool("events", "get_upcoming_events", {})
      .then(res => JSON.parse((res as any).content[0].text))
      .catch(err => ({ error: err.message || "Failed to load events" }));

    const academicsDataPromise = gateway.executeTool("academics", "search_courses", { query: "CS" })
      .then(res => JSON.parse((res as any).content[0].text))
      .catch(err => ({ error: err.message || "Failed to load academics" }));

    const [library, cafeteria, events, academics] = await Promise.all([
      libraryDataPromise,
      cafeteriaDataPromise,
      eventsDataPromise,
      academicsDataPromise,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        library,
        cafeteria,
        events,
        academics,
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
