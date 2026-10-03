/** An error whose message is safe to show to the caller, with the HTTP status to use. */
export class RequestError extends Error {
  override name = "RequestError";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
