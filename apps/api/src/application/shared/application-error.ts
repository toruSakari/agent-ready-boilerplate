export type ApplicationErrorReason =
  | "STOCK_OPERATION_CONFLICT"
  | "STOCK_CHANGED"
  | "STOCK_RESERVED"
  | "LAST_OWNER_REQUIRED"
  | "INVITATION_INVALID"
  | "EMAIL_VERIFICATION_REQUIRED";

export type ApplicationErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_SERVER_ERROR";

/** 利用者へ返せる既知の業務エラー。HTTP・tRPCへの変換と内部例外の秘匿はpresentationが担う。 */
export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly reason?: ApplicationErrorReason;

  constructor(input: {
    code: ApplicationErrorCode;
    message: string;
    cause?: unknown;
    reason?: ApplicationErrorReason;
  }) {
    super(input.message, { cause: input.cause });
    this.name = "ApplicationError";
    this.code = input.code;
    this.reason = input.reason;
  }
}
