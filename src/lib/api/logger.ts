/**
 * Structured, console-based for now — swap the implementation (not the call
 * sites) for DB-backed logging once the admin page needs to display
 * historical sync/API errors.
 */
type LogFields = Record<string, unknown>;

function format(level: string, message: string, fields?: LogFields) {
  const base = { level, message, timestamp: new Date().toISOString(), ...fields };
  return JSON.stringify(base);
}

export const logger = {
  info(message: string, fields?: LogFields) {
    console.log(format("info", message, fields));
  },
  warn(message: string, fields?: LogFields) {
    console.warn(format("warn", message, fields));
  },
  error(message: string, fields?: LogFields) {
    console.error(format("error", message, fields));
  },
};
