export class ProviderApiError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "ProviderApiError";
  }
}
