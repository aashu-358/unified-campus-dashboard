import { NextResponse } from "next/server";
import { gateway } from "@/lib/mcpClient";
import { readLogs } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await gateway.initialize();
    const statuses = gateway.getStatuses();
    const logs = readLogs(60);
    return NextResponse.json({
      success: true,
      statuses,
      logs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
