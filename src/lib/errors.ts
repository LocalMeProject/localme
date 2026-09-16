/**
 * Convex wraps thrown errors as they cross function boundaries, so the platform
 * embeds `[localme:status:code]` in the message. This strips the wrapper, the
 * marker and the stack frames so the dashboard can show a readable sentence.
 */
export function errorText(error: unknown): string {
  let text = error instanceof Error ? error.message : String(error ?? "");
  text = text.replace(/\s*\n\s+at [^\n]*/g, "");
  text = text.replace(/\[localme:\d{3}:[a-z_]+\]\s*/g, "");
  for (let pass = 0; pass < 3; pass += 1) {
    text = text.replace(/^(Uncaught\s+)?(LocalMeError|Error|ConvexError|Server Error)\s*:\s*/i, "");
  }
  text = text.replace(/\s*\[Request ID:[^\]]*\]/g, "");
  return text.trim() || "Something went wrong. Please try again.";
}

export function isPermissionError(error: unknown): boolean {
  return /\[localme:401:/.test(String(error)) || /unauthenticated/i.test(errorText(error));
}
