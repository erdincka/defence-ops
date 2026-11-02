import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const CONFIG_PATH = process.env.CONFIG_PATH || "/app/data/config.json";

// Secrets never leave the server: GET blanks them and lists which are stored, and a blank value in
// a POST keeps the stored one. The backends read them from CONFIG_PATH on the shared volume.
const SECRET_FIELDS = ["llm_api_key", "kafka_password"] as const;

const demoServicesSchema = z.object({
  llm_endpoint: z.string().trim().max(500).default(""),
  llm_api_key: z.string().trim().max(500).default(""),
  llm_model: z.string().trim().max(200).default(""),
  llm_provider: z.enum(["openai", "ollama"]).default("openai"),
  kafka_broker: z.string().trim().max(500).default(""),
  kafka_topic: z.string().trim().max(249).default(""),
  kafka_username: z.string().trim().max(200).default(""),
  kafka_password: z.string().max(500).default(""),
});

const storedConfigSchema = z.looseObject({
  demo_services: z.record(z.string(), z.unknown()).optional(),
});

type StoredConfig = z.infer<typeof storedConfigSchema>;

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

async function loadConfig(): Promise<StoredConfig> {
  let text: string;
  try {
    text = await fs.readFile(CONFIG_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  return storedConfigSchema.parse(JSON.parse(text));
}

async function saveConfig(config: StoredConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  // Write a temporary file and rename it, so a failed write never leaves half a file behind.
  const tmpPath = `${CONFIG_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(config, null, 2));
  await fs.rename(tmpPath, CONFIG_PATH);
}

export async function GET() {
  try {
    const services = (await loadConfig()).demo_services ?? {};
    const storedSecrets = SECRET_FIELDS.filter((field) => {
      const value = services[field];
      return typeof value === "string" && value !== "";
    });
    const data: Record<string, unknown> = { ...services };
    for (const field of SECRET_FIELDS) data[field] = "";
    return NextResponse.json({ status: "success", data, meta: { stored_secrets: storedSecrets } });
  } catch (err) {
    return errorResponse(
      `Could not read the saved settings from ${CONFIG_PATH}: ${describe(err)}. ` +
        "Check that the app-data volume is mounted and the file holds valid JSON.",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Settings not saved: the request body is not valid JSON.", 400);
  }

  const parsed = demoServicesSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    return errorResponse(`Settings not saved: ${detail}`, 400);
  }

  try {
    const current = await loadConfig();
    const stored = current.demo_services ?? {};
    const merged: Record<string, unknown> = { ...parsed.data };
    for (const field of SECRET_FIELDS) {
      if (parsed.data[field] === "" && typeof stored[field] === "string") merged[field] = stored[field];
    }
    await saveConfig({ ...current, demo_services: merged });
  } catch (err) {
    return errorResponse(
      `Settings not saved: could not write ${CONFIG_PATH} (${describe(err)}). ` +
        "Check that the app-data volume is mounted and writable.",
      500,
    );
  }

  return NextResponse.json({ status: "success", message: "Configuration saved successfully" });
}
