export type StageTimings = Partial<Record<"turnstile_ms" | "ext_rag_ms" | "static_ms", number>>;

function milliseconds(value: number): number {
  return Number.isNaN(value) ? 0 : Math.min(600000, Math.max(0, Math.round(value)));
}

export async function timeStage<T>(
  stages: StageTimings,
  name: keyof StageTimings,
  run: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    return await run();
  } finally {
    stages[name] = milliseconds(performance.now() - started);
  }
}

export function sendStageTiming(
  context: {
    request: Request;
    env: {
      APP_HEALTH_INGEST_KEY?: string;
      APP_HEALTH_ENVIRONMENT?: string;
      APP_HEALTH_STAGE_SAMPLE_RATE?: string;
    };
    waitUntil?: (delivery: Promise<unknown>) => void;
  },
  started: number,
  status: number,
  cold: number,
  stages: StageTimings,
): void {
  try {
    const key = context.env.APP_HEALTH_INGEST_KEY;
    if (typeof key !== "string" || key.length === 0) return;
    const configuredRate = Number(context.env.APP_HEALTH_STAGE_SAMPLE_RATE ?? 0.1);
    const rate = Number.isNaN(configuredRate) ? 0.1 : Math.min(1, Math.max(0, configuredRate));
    if (!(Math.random() < rate)) return;
    const colo = (context.request as Request & { cf?: { colo?: unknown } }).cf?.colo;
    const props = {
      route: "/api/rag/query",
      status,
      total_ms: milliseconds(performance.now() - started),
      edge_cache: "NONE",
      inner_cache: "NONE",
      colo: typeof colo === "string" && /^[A-Za-z0-9]{1,8}$/.test(colo) ? colo : "unknown",
      cold,
      ...stages,
    };
    const delivery = Promise.resolve()
      .then(() =>
        fetch("https://ingest.sassmaker.com/v1/logs", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batch_id: crypto.randomUUID(),
            schema_version: "v1",
            environment: context.env.APP_HEALTH_ENVIRONMENT?.trim() || "production",
            logs: [
              {
                log_id: crypto.randomUUID(),
                timestamp: Date.now(),
                event: "api.stage_timing",
                level: "debug",
                props,
              },
            ],
          }),
        }),
      )
      .catch(() => {});
    context.waitUntil?.(delivery);
  } catch {
    // Telemetry must never affect the query response.
  }
}
