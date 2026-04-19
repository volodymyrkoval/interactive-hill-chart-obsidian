export interface Logger {
  warn(msg: string, ctx?: Record<string, unknown>): void;
}

export const consoleLogger: Logger = {
  warn(msg, ctx) {
    console.warn(msg, ctx);
  },
};
