import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve("logs");
const LOG_FILE = path.join(LOG_DIR, "mcp-gateway.log");

export function writeLog(level: "INFO" | "WARN" | "ERROR" | "DEBUG", component: string, message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] [${component}] ${message}\n`;

  // Write to console
  if (level === "ERROR") {
    console.error(`[${level}] [${component}] ${message}`);
  } else if (level === "WARN") {
    console.warn(`[${level}] [${component}] ${message}`);
  } else {
    console.log(`[${level}] [${component}] ${message}`);
  }

  // Write to log file
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logMessage, "utf-8");
  } catch (err) {
    console.error("Failed to append to log file:", err);
  }
}

export function readLogs(limit = 100): string[] {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n");
    return lines.slice(-limit);
  } catch (err) {
    console.error("Failed to read log file:", err);
    return [];
  }
}
