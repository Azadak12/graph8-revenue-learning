export function getLogger(name: string) {
  return {
    info: (event: string, meta: Record<string, unknown> = {}) =>
      console.log(JSON.stringify({ level: "info", logger: name, event, ...meta })),
    warning: (event: string, meta: Record<string, unknown> = {}) =>
      console.warn(JSON.stringify({ level: "warning", logger: name, event, ...meta })),
    error: (event: string, meta: Record<string, unknown> = {}) =>
      console.error(JSON.stringify({ level: "error", logger: name, event, ...meta })),
    exception: (event: string, err: unknown, meta: Record<string, unknown> = {}) =>
      console.error(
        JSON.stringify({
          level: "error",
          logger: name,
          event,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          ...meta,
        })
      ),
  };
}
