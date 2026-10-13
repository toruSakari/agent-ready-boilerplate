import type { Service } from "@dev-template/client/api";
import type { AuthenticationStatus } from "#client/shared/api/authentication-context";

export type StoryApp = "web" | "business" | "admin";

export const STORY_SERVICES: Record<StoryApp, Service> = {
  web: "customer",
  business: "business",
  admin: "operator",
};

export type StoryResult = {
  data?: unknown;
  error?: string;
  errorCode?: "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST";
  errorReason?:
    | "EMAIL_VERIFICATION_REQUIRED"
    | "LAST_OWNER_REQUIRED"
    | "INVITATION_INVALID"
    | "STOCK_OPERATION_CONFLICT"
    | "STOCK_CHANGED"
    | "STOCK_RESERVED";
  pending?: boolean;
};

export type StoryFixtures = {
  mode?: StoryApp;
  organizationId?: string;
  authentication?: AuthenticationStatus;
  queries?: Record<string, StoryResult>;
  mutations?: Record<string, StoryResult>;
  image?: "ready" | "error" | "pending";
  imageMutation?: { error?: string; pending?: boolean };
};
