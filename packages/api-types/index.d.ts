import * as _trpc_server from "@trpc/server";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import * as zod from "zod";

declare const IMAGE_CONTENT_TYPES: Readonly<{
  readonly png: "image/png";
  readonly jpeg: "image/jpeg";
  readonly webp: "image/webp";
}>;
type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[keyof typeof IMAGE_CONTENT_TYPES];
type ApplicationErrorReason =
  | "STOCK_OPERATION_CONFLICT"
  | "STOCK_CHANGED"
  | "STOCK_RESERVED"
  | "LAST_OWNER_REQUIRED"
  | "INVITATION_INVALID"
  | "EMAIL_VERIFICATION_REQUIRED";
declare const appRouter: _trpc_server.TRPCBuiltRouter<
  {
    ctx: unknown;
    meta: {
      standalone?: boolean;
      public?: boolean;
    };
    errorShape: {
      message: string;
      data: {
        errorCode:
          | "BAD_GATEWAY"
          | "BAD_REQUEST"
          | "CLIENT_CLOSED_REQUEST"
          | "CONFLICT"
          | "FORBIDDEN"
          | "GATEWAY_TIMEOUT"
          | "INTERNAL_SERVER_ERROR"
          | "METHOD_NOT_SUPPORTED"
          | "NOT_FOUND"
          | "NOT_IMPLEMENTED"
          | "PARSE_ERROR"
          | "PAYLOAD_TOO_LARGE"
          | "PAYMENT_REQUIRED"
          | "PRECONDITION_FAILED"
          | "PRECONDITION_REQUIRED"
          | "SERVICE_UNAVAILABLE"
          | "TIMEOUT"
          | "TOO_MANY_REQUESTS"
          | "UNAUTHORIZED"
          | "UNPROCESSABLE_CONTENT"
          | "UNSUPPORTED_MEDIA_TYPE"
          | ApplicationErrorReason;
        code: _trpc_server.TRPC_ERROR_CODE_KEY;
        httpStatus: number;
        path?: string;
      };
      code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
    };
    transformer: false;
  },
  _trpc_server.TRPCDecorateCreateRouterOptions<{
    inventory: _trpc_server.TRPCBuiltRouter<
      {
        ctx: unknown;
        meta: {
          standalone?: boolean;
          public?: boolean;
        };
        errorShape: {
          message: string;
          data: {
            errorCode:
              | "BAD_GATEWAY"
              | "BAD_REQUEST"
              | "CLIENT_CLOSED_REQUEST"
              | "CONFLICT"
              | "FORBIDDEN"
              | "GATEWAY_TIMEOUT"
              | "INTERNAL_SERVER_ERROR"
              | "METHOD_NOT_SUPPORTED"
              | "NOT_FOUND"
              | "NOT_IMPLEMENTED"
              | "PARSE_ERROR"
              | "PAYLOAD_TOO_LARGE"
              | "PAYMENT_REQUIRED"
              | "PRECONDITION_FAILED"
              | "PRECONDITION_REQUIRED"
              | "SERVICE_UNAVAILABLE"
              | "TIMEOUT"
              | "TOO_MANY_REQUESTS"
              | "UNAUTHORIZED"
              | "UNPROCESSABLE_CONTENT"
              | "UNSUPPORTED_MEDIA_TYPE"
              | ApplicationErrorReason;
            code: _trpc_server.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
          };
          code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
        };
        transformer: false;
      },
      _trpc_server.TRPCDecorateCreateRouterOptions<{
        list: _trpc_server.TRPCQueryProcedure<{
          input:
            | {
                cursor?:
                  | {
                      createdAt: string;
                      id: string;
                    }
                  | undefined;
                search?: string | undefined;
                sort?: "newest" | "oldest" | undefined;
                stock?: "in-stock" | "out-of-stock" | undefined;
                limit?: number | undefined;
              }
            | undefined;
          output: (Readonly<
            {
              onHand: number;
              reserved: number;
              available: number;
            } & zod.$brand<"ManagedStockDto">
          > & {
            id: string;
            sku: string;
            name: string;
            createdAt: string;
          })[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        history: _trpc_server.TRPCQueryProcedure<{
          input: {
            id: string;
            limit?: number | undefined;
            cursor?:
              | {
                  createdAt: string;
                  id: string;
                }
              | undefined;
          };
          output: Readonly<
            {
              id: string;
              operation: "receive" | "recount" | "initial";
              reason: "delivery" | "return" | "stocktake" | "damage" | "correction" | "initial";
              quantity: number;
              beforeStock: number;
              afterStock: number;
              createdAt: string;
              actorName: string | null;
            } & zod.$brand<"StockHistoryEntryDto">
          >[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        adjust: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            operationId: string;
            adjustment:
              | {
                  operation: "receive";
                  quantity: number;
                  reason: "delivery" | "return";
                }
              | {
                  operation: "recount";
                  quantity: number;
                  reason: "stocktake" | "damage" | "correction";
                  expectedStock: number;
                };
          };
          output: Readonly<
            {
              onHand: number;
              reserved: number;
              available: number;
            } & zod.$brand<"ManageStockAdjustOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        get: _trpc_server.TRPCQueryProcedure<{
          input: {
            id: string;
          };
          output: Readonly<
            {
              onHand: number;
              reserved: number;
              available: number;
            } & zod.$brand<"ManageStockGetOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        change: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            quantity: number;
            expectedStock: number;
          };
          output: Readonly<
            {
              onHand: number;
              reserved: number;
              available: number;
            } & zod.$brand<"ManageStockChangeOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
      }>
    >;
    store: _trpc_server.TRPCBuiltRouter<
      {
        ctx: unknown;
        meta: {
          standalone?: boolean;
          public?: boolean;
        };
        errorShape: {
          message: string;
          data: {
            errorCode:
              | "BAD_GATEWAY"
              | "BAD_REQUEST"
              | "CLIENT_CLOSED_REQUEST"
              | "CONFLICT"
              | "FORBIDDEN"
              | "GATEWAY_TIMEOUT"
              | "INTERNAL_SERVER_ERROR"
              | "METHOD_NOT_SUPPORTED"
              | "NOT_FOUND"
              | "NOT_IMPLEMENTED"
              | "PARSE_ERROR"
              | "PAYLOAD_TOO_LARGE"
              | "PAYMENT_REQUIRED"
              | "PRECONDITION_FAILED"
              | "PRECONDITION_REQUIRED"
              | "SERVICE_UNAVAILABLE"
              | "TIMEOUT"
              | "TOO_MANY_REQUESTS"
              | "UNAUTHORIZED"
              | "UNPROCESSABLE_CONTENT"
              | "UNSUPPORTED_MEDIA_TYPE"
              | ApplicationErrorReason;
            code: _trpc_server.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
          };
          code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
        };
        transformer: false;
      },
      _trpc_server.TRPCDecorateCreateRouterOptions<{
        list: _trpc_server.TRPCQueryProcedure<{
          input: {
            search?: string | undefined;
            sort?: "newest" | "oldest" | undefined;
            stock?: "in-stock" | "out-of-stock" | undefined;
            minPrice?: number | undefined;
            maxPrice?: number | undefined;
            limit?: number | undefined;
            cursor?:
              | {
                  createdAt: string;
                  id: string;
                }
              | undefined;
          };
          output: Readonly<
            {
              items: Readonly<
                {
                  id: string;
                  tenantId: string;
                  organizationName: string;
                  sku: string;
                  name: string;
                  unitPrice: number;
                  availableQuantity: number;
                  createdAt: string;
                  images: {
                    id: string;
                  }[];
                } & zod.$brand<"StoreProductDto">
              >[];
              nextCursor: {
                createdAt: string;
                id: string;
              } | null;
            } & zod.$brand<"StoreListOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        get: _trpc_server.TRPCQueryProcedure<{
          input: {
            tenantId: string;
            sku: string;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              organizationName: string;
              sku: string;
              name: string;
              unitPrice: number;
              availableQuantity: number;
              createdAt: string;
              images: {
                id: string;
              }[];
            } & zod.$brand<"StoreGetOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        getImage: _trpc_server.TRPCQueryProcedure<{
          input: {
            tenantId: string;
            sku: string;
            imageId?: string | undefined;
          };
          output: {
            base64: string;
            contentType: ImageContentType;
            etag: string;
          };
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        checkout: _trpc_server.TRPCMutationProcedure<{
          input: {
            tenantId: string;
            lines: {
              sku: string;
              name: string;
              quantity: number;
              unitPrice: number;
            }[];
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & zod.$brand<"StoreCheckoutOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        listOrders: _trpc_server.TRPCQueryProcedure<{
          input: {
            search?: string | undefined;
            sort?: "newest" | "oldest" | undefined;
            status?: "draft" | "confirmed" | "shipped" | "completed" | "cancelled" | undefined;
            from?: string | undefined;
            to?: string | undefined;
            limit?: number | undefined;
            cursor?:
              | {
                  createdAt: string;
                  id: string;
                }
              | undefined;
          };
          output: Readonly<
            {
              items: Readonly<
                {
                  id: string;
                  tenantId: string;
                  customerId: string;
                  status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
                  lines: Readonly<{
                    sku: string;
                    name: string;
                    quantity: number;
                    unitPrice: number;
                  }>[];
                  total: number;
                  createdAt: string;
                  version: number;
                  reservationId: string | null;
                } & {
                  paymentStatus?: string | null | undefined;
                  statusLabel?: string | undefined;
                } & zod.$brand<"OrderListItemDto">
              >[];
              nextCursor: {
                createdAt: string;
                id: string;
              } | null;
            } & zod.$brand<"StoreListOrdersOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        cancelOrder: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            version: number;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & zod.$brand<"StoreCancelOrderOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        getOrder: _trpc_server.TRPCQueryProcedure<{
          input: {
            id: string;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & {
              paymentStatus?: string | null | undefined;
              statusLabel?: string | undefined;
            } & zod.$brand<"StoreGetOrderOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
      }>
    >;
    dashboard: _trpc_server.TRPCBuiltRouter<
      {
        ctx: unknown;
        meta: {
          standalone?: boolean;
          public?: boolean;
        };
        errorShape: {
          message: string;
          data: {
            errorCode:
              | "BAD_GATEWAY"
              | "BAD_REQUEST"
              | "CLIENT_CLOSED_REQUEST"
              | "CONFLICT"
              | "FORBIDDEN"
              | "GATEWAY_TIMEOUT"
              | "INTERNAL_SERVER_ERROR"
              | "METHOD_NOT_SUPPORTED"
              | "NOT_FOUND"
              | "NOT_IMPLEMENTED"
              | "PARSE_ERROR"
              | "PAYLOAD_TOO_LARGE"
              | "PAYMENT_REQUIRED"
              | "PRECONDITION_FAILED"
              | "PRECONDITION_REQUIRED"
              | "SERVICE_UNAVAILABLE"
              | "TIMEOUT"
              | "TOO_MANY_REQUESTS"
              | "UNAUTHORIZED"
              | "UNPROCESSABLE_CONTENT"
              | "UNSUPPORTED_MEDIA_TYPE"
              | ApplicationErrorReason;
            code: _trpc_server.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
          };
          code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
        };
        transformer: false;
      },
      _trpc_server.TRPCDecorateCreateRouterOptions<{
        summary: _trpc_server.TRPCQueryProcedure<{
          input: void;
          output: Readonly<
            {
              ordersTotal: number | null;
              draftCount: number | null;
              confirmedCount: number | null;
              productsTotal: number | null;
              membersTotal: number | null;
            } & zod.$brand<"DashboardOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
      }>
    >;
    access: _trpc_server.TRPCBuiltRouter<
      {
        ctx: unknown;
        meta: {
          standalone?: boolean;
          public?: boolean;
        };
        errorShape: {
          message: string;
          data: {
            errorCode:
              | "BAD_GATEWAY"
              | "BAD_REQUEST"
              | "CLIENT_CLOSED_REQUEST"
              | "CONFLICT"
              | "FORBIDDEN"
              | "GATEWAY_TIMEOUT"
              | "INTERNAL_SERVER_ERROR"
              | "METHOD_NOT_SUPPORTED"
              | "NOT_FOUND"
              | "NOT_IMPLEMENTED"
              | "PARSE_ERROR"
              | "PAYLOAD_TOO_LARGE"
              | "PAYMENT_REQUIRED"
              | "PRECONDITION_FAILED"
              | "PRECONDITION_REQUIRED"
              | "SERVICE_UNAVAILABLE"
              | "TIMEOUT"
              | "TOO_MANY_REQUESTS"
              | "UNAUTHORIZED"
              | "UNPROCESSABLE_CONTENT"
              | "UNSUPPORTED_MEDIA_TYPE"
              | ApplicationErrorReason;
            code: _trpc_server.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
          };
          code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
        };
        transformer: false;
      },
      _trpc_server.TRPCDecorateCreateRouterOptions<{
        businessIpPolicy: _trpc_server.TRPCQueryProcedure<{
          input: {
            id: string;
          };
          output: Readonly<
            {
              enabled: boolean;
              allowedIps: string[];
            } & zod.$brand<"AccessOrganizationBusinessIpPolicyOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        updateBusinessIpPolicy: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            enabled: boolean;
            allowedIps: string[];
          };
          output: void;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        plans: _trpc_server.TRPCQueryProcedure<{
          input: {
            category: "business";
          };
          output: {
            code: string;
            name: string;
            category: "business" | "customer";
            permissions: readonly (
              | "organization.read"
              | "organization.manage"
              | "user.read"
              | "user.personal.read"
              | "user.delete"
              | "plan.manage"
              | "member.read"
              | "member.invite"
              | "member.assign_role"
              | "member.remove"
              | "role.manage"
              | "audit.read"
              | "order:read"
              | "order:create"
              | "order:update"
              | "product.read"
              | "product.update"
            )[];
          }[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        organizationPlan: _trpc_server.TRPCQueryProcedure<{
          input: {
            id: string;
          };
          output: Readonly<
            {
              code: string | null;
            } & zod.$brand<"AccessOrganizationOrganizationPlanOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        assignPlan: _trpc_server.TRPCMutationProcedure<{
          input: {
            category: "business";
            id: string;
            planCode: string | null;
          };
          output: undefined;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        organizationPlanOptions: _trpc_server.TRPCQueryProcedure<{
          input: void;
          output: {
            code: string;
            name: string;
          }[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        organizationDirectory: _trpc_server.TRPCQueryProcedure<{
          input: {
            search?: string | undefined;
            status?: "active" | "inactive" | undefined;
            planCode?: string | undefined;
            limit?: number | undefined;
            afterId?: string | undefined;
          };
          output: Readonly<
            {
              items: Readonly<
                {
                  id: string;
                  name: string;
                  active: boolean;
                  invitationsEnabled: boolean;
                  memberCount: number;
                  planCode: string | null;
                } & zod.$brand<"OrganizationDirectoryItemDto">
              >[];
              nextId: string | null;
            } & zod.$brand<"ListOrganizationDirectoryOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        organizations: _trpc_server.TRPCQueryProcedure<{
          input: void;
          output: {
            id: string;
            name: string;
            active: boolean;
            invitationsEnabled: boolean;
            memberCount: number;
          }[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        createOrganization: _trpc_server.TRPCMutationProcedure<{
          input: {
            name: string;
          };
          output: Readonly<
            {
              id: string;
            } & zod.$brand<"AccessOrganizationCreateOrganizationOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        updateOrganization: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            name: string;
            active: boolean;
            invitationsEnabled: boolean;
          };
          output: undefined;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
      }> &
        _trpc_server.TRPCDecorateCreateRouterOptions<{
          members: _trpc_server.TRPCQueryProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
            };
            output: {
              id: string;
              userId: string;
              category: "operator" | "business" | "customer";
              name: string;
              email: string | null;
              roleId: string;
              roleName: string;
              protectedRole: boolean;
            }[];
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          roles: _trpc_server.TRPCQueryProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
            };
            output: {
              id: string;
              name: string;
              protectedRole: boolean;
              permissions: readonly (
                | "organization.read"
                | "organization.manage"
                | "user.read"
                | "user.personal.read"
                | "user.delete"
                | "plan.manage"
                | "member.read"
                | "member.invite"
                | "member.assign_role"
                | "member.remove"
                | "role.manage"
                | "audit.read"
                | "order:read"
                | "order:create"
                | "order:update"
                | "product.read"
                | "product.update"
              )[];
            }[];
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          rolePermissionCatalog: _trpc_server.TRPCQueryProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
            };
            output: Readonly<
              Record<
                string,
                | "企業一覧の閲覧"
                | "企業の作成・変更・停止"
                | "全ユーザーの基本情報閲覧"
                | "個人情報の閲覧"
                | "アカウント削除"
                | "プランの割当管理"
                | "メンバー閲覧"
                | "メンバー招待"
                | "メンバーのロール変更"
                | "所属解除"
                | "カスタムロール管理"
                | "監査ログ閲覧"
                | "注文閲覧"
                | "注文作成"
                | "注文変更"
                | "商品閲覧"
                | "商品管理"
              > &
                zod.$brand<"AccessRoleRolePermissionCatalogOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          saveRole: _trpc_server.TRPCMutationProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
              name: string;
              permissions: string[];
              id?: string | undefined;
            };
            output: Readonly<
              {
                id: string;
              } & zod.$brand<"AccessRoleSaveRoleOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          invite: _trpc_server.TRPCMutationProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
              email: string;
              roleId: string;
              actorKind: "operator" | "business" | "customer";
            };
            output: Readonly<
              {
                token: string;
                expiresAt: string;
                scope: string;
                actorKind: "operator" | "business" | "customer";
              } & zod.$brand<"AccessInvitationInviteOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          assignRole: _trpc_server.TRPCMutationProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
              membershipId: string;
              roleId: string;
            };
            output: undefined;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          removeMember: _trpc_server.TRPCMutationProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
              membershipId: string;
            };
            output: undefined;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          audit: _trpc_server.TRPCQueryProcedure<{
            input: {
              service: "operator" | "business";
              scope: string;
            };
            output: {
              id: string;
              actorId: string;
              scope: string;
              action: string;
              targetId: string;
              occurredAt: string;
            }[];
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
        }> &
        _trpc_server.TRPCDecorateCreateRouterOptions<{
          customerPlans: _trpc_server.TRPCQueryProcedure<{
            input: void;
            output: Readonly<
              {
                currentCode: string | null;
                plans: {
                  code: string;
                  name: string;
                }[];
              } & zod.$brand<"CustomerPlanPlansOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          changeCustomerPlan: _trpc_server.TRPCMutationProcedure<{
            input: {
              planCode: string | null;
            };
            output: undefined;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          registration: _trpc_server.TRPCQueryProcedure<{
            input: {
              service: "operator" | "business" | "customer";
            };
            output: Readonly<
              {
                registered: boolean;
                category: "operator" | "business" | "customer";
                accountId: string | null;
              } & zod.$brand<"AccessRegistrationOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          registerCustomer: _trpc_server.TRPCMutationProcedure<{
            input: {
              name: string;
            };
            output: Readonly<
              {
                accountId: string;
              } & zod.$brand<"AccessRegisterCustomerOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          withdraw: _trpc_server.TRPCMutationProcedure<{
            input: {
              service: "operator" | "business" | "customer";
            };
            output: Readonly<
              {
                category: "operator" | "business" | "customer";
              } & zod.$brand<"AccessWithdrawOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          session: _trpc_server.TRPCQueryProcedure<{
            input: {
              service: "operator" | "business" | "customer";
            };
            output: Readonly<
              {
                userId: string;
                organizations: {
                  id: string;
                  name: string;
                  roleName: string;
                }[];
                platformPermissions: readonly (
                  | "organization.read"
                  | "organization.manage"
                  | "user.read"
                  | "user.personal.read"
                  | "user.delete"
                  | "plan.manage"
                  | "member.read"
                  | "member.invite"
                  | "member.assign_role"
                  | "member.remove"
                  | "role.manage"
                  | "audit.read"
                  | "order:read"
                  | "order:create"
                  | "order:update"
                  | "product.read"
                  | "product.update"
                )[];
                permissions: (
                  | "organization.read"
                  | "organization.manage"
                  | "user.read"
                  | "user.personal.read"
                  | "user.delete"
                  | "plan.manage"
                  | "member.read"
                  | "member.invite"
                  | "member.assign_role"
                  | "member.remove"
                  | "role.manage"
                  | "audit.read"
                  | "order:read"
                  | "order:create"
                  | "order:update"
                  | "product.read"
                  | "product.update"
                )[];
                permissionCatalog: {
                  "organization.read": "企業一覧の閲覧";
                  "organization.manage": "企業の作成・変更・停止";
                  "user.read": "全ユーザーの基本情報閲覧";
                  "user.personal.read": "個人情報の閲覧";
                  "user.delete": "アカウント削除";
                  "plan.manage": "プランの割当管理";
                  "member.read": "メンバー閲覧";
                  "member.invite": "メンバー招待";
                  "member.assign_role": "メンバーのロール変更";
                  "member.remove": "所属解除";
                  "role.manage": "カスタムロール管理";
                  "audit.read": "監査ログ閲覧";
                  "order:read": "注文閲覧";
                  "order:create": "注文作成";
                  "order:update": "注文変更";
                  "product.read": "商品閲覧";
                  "product.update": "商品管理";
                };
                channel?: "business" | "customer" | "admin" | undefined;
              } & zod.$brand<"AccessDirectorySessionOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          users: _trpc_server.TRPCQueryProcedure<{
            input: void;
            output: {
              id: string;
              category: "operator" | "business" | "customer";
              name: string;
              email: string | null;
              memberships: {
                id: string;
                scope: string;
                organizationName: string;
                roleName: string;
                roleId: string;
              }[];
            }[];
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          deleteUser: _trpc_server.TRPCMutationProcedure<{
            input: {
              userId: string;
            };
            output: undefined;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
          acceptInvitation: _trpc_server.TRPCMutationProcedure<{
            input: {
              service: "operator" | "business" | "customer";
              token: string;
              name: string;
            };
            output: Readonly<
              {
                scope: string;
              } & zod.$brand<"AccessAcceptInvitationOutputDto">
            >;
            meta: {
              standalone?: boolean;
              public?: boolean;
            };
          }>;
        }>
    >;
    health: _trpc_server.TRPCQueryProcedure<{
      input: {
        service: "operator" | "business" | "customer";
      };
      output: {
        status: "ok";
      };
      meta: {
        standalone?: boolean;
        public?: boolean;
      };
    }>;
    product: _trpc_server.TRPCBuiltRouter<
      {
        ctx: unknown;
        meta: {
          standalone?: boolean;
          public?: boolean;
        };
        errorShape: {
          message: string;
          data: {
            errorCode:
              | "BAD_GATEWAY"
              | "BAD_REQUEST"
              | "CLIENT_CLOSED_REQUEST"
              | "CONFLICT"
              | "FORBIDDEN"
              | "GATEWAY_TIMEOUT"
              | "INTERNAL_SERVER_ERROR"
              | "METHOD_NOT_SUPPORTED"
              | "NOT_FOUND"
              | "NOT_IMPLEMENTED"
              | "PARSE_ERROR"
              | "PAYLOAD_TOO_LARGE"
              | "PAYMENT_REQUIRED"
              | "PRECONDITION_FAILED"
              | "PRECONDITION_REQUIRED"
              | "SERVICE_UNAVAILABLE"
              | "TIMEOUT"
              | "TOO_MANY_REQUESTS"
              | "UNAUTHORIZED"
              | "UNPROCESSABLE_CONTENT"
              | "UNSUPPORTED_MEDIA_TYPE"
              | ApplicationErrorReason;
            code: _trpc_server.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
          };
          code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
        };
        transformer: false;
      },
      _trpc_server.TRPCDecorateCreateRouterOptions<{
        get: _trpc_server.TRPCQueryProcedure<{
          input: {
            service: "business" | "customer";
            id: string;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              sku: string;
              name: string;
              unitPrice: number;
              imageKey: string | null;
              images: {
                id: string;
                key: string;
                createdAt: string;
              }[];
              createdAt: string;
            } & zod.$brand<"ProductGetOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        update: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            name: string;
            unitPrice: number;
            expectedName: string;
            expectedUnitPrice: number;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              sku: string;
              name: string;
              unitPrice: number;
              imageKey: string | null;
              images: {
                id: string;
                key: string;
                createdAt: string;
              }[];
              createdAt: string;
            } & zod.$brand<"ProductUpdateOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        getImage: _trpc_server.TRPCQueryProcedure<{
          input: {
            service: "business" | "customer";
            id: string;
            imageId?: string | undefined;
          };
          output: {
            base64: string;
            contentType: ImageContentType;
            etag: string;
          };
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        replaceImage: _trpc_server.TRPCMutationProcedure<{
          input: FormData;
          output: {
            ok: boolean;
          };
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        addImage: _trpc_server.TRPCMutationProcedure<{
          input: FormData;
          output: {
            ok: boolean;
          };
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        deleteImage: _trpc_server.TRPCMutationProcedure<{
          input: {
            id: string;
            imageId?: string | undefined;
          };
          output: {
            ok: boolean;
          };
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        list: _trpc_server.TRPCQueryProcedure<{
          input: {
            service: "business" | "customer";
            limit?: number | undefined;
            cursor?:
              | {
                  createdAt: string;
                  id: string;
                }
              | undefined;
            search?: string | undefined;
            sort?: "newest" | "oldest" | undefined;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              sku: string;
              name: string;
              unitPrice: number;
              imageKey: string | null;
              images: {
                id: string;
                key: string;
                createdAt: string;
              }[];
              createdAt: string;
            } & zod.$brand<"ProductListItemDto">
          >[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        create: _trpc_server.TRPCMutationProcedure<{
          input: {
            sku: string;
            name: string;
            unitPrice: number;
            initialStock?: number | undefined;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              sku: string;
              name: string;
              unitPrice: number;
              imageKey: string | null;
              images: {
                id: string;
                key: string;
                createdAt: string;
              }[];
              createdAt: string;
            } & zod.$brand<"CreateProductOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
      }>
    >;
    order: _trpc_server.TRPCBuiltRouter<
      {
        ctx: unknown;
        meta: {
          standalone?: boolean;
          public?: boolean;
        };
        errorShape: {
          message: string;
          data: {
            errorCode:
              | "BAD_GATEWAY"
              | "BAD_REQUEST"
              | "CLIENT_CLOSED_REQUEST"
              | "CONFLICT"
              | "FORBIDDEN"
              | "GATEWAY_TIMEOUT"
              | "INTERNAL_SERVER_ERROR"
              | "METHOD_NOT_SUPPORTED"
              | "NOT_FOUND"
              | "NOT_IMPLEMENTED"
              | "PARSE_ERROR"
              | "PAYLOAD_TOO_LARGE"
              | "PAYMENT_REQUIRED"
              | "PRECONDITION_FAILED"
              | "PRECONDITION_REQUIRED"
              | "SERVICE_UNAVAILABLE"
              | "TIMEOUT"
              | "TOO_MANY_REQUESTS"
              | "UNAUTHORIZED"
              | "UNPROCESSABLE_CONTENT"
              | "UNSUPPORTED_MEDIA_TYPE"
              | ApplicationErrorReason;
            code: _trpc_server.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
          };
          code: _trpc_server.TRPC_ERROR_CODE_NUMBER;
        };
        transformer: false;
      },
      _trpc_server.TRPCDecorateCreateRouterOptions<{
        get: _trpc_server.TRPCQueryProcedure<{
          input: {
            service: "business" | "customer";
            id: string;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & {
              paymentStatus?: string | null | undefined;
              statusLabel?: string | undefined;
            } & zod.$brand<"GetOrderOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        update: _trpc_server.TRPCMutationProcedure<{
          input: {
            service: "business" | "customer";
            id: string;
            version: number;
            lines: {
              sku: string;
              name: string;
              quantity: number;
              unitPrice: number;
            }[];
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & zod.$brand<"ManageOrderOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        transition: _trpc_server.TRPCMutationProcedure<{
          input: {
            service: "business" | "customer";
            id: string;
            version: number;
            status: "confirmed" | "shipped" | "completed" | "cancelled";
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & zod.$brand<"ManageOrderOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        list: _trpc_server.TRPCQueryProcedure<{
          input: {
            service: "business" | "customer";
            search?: string | undefined;
            sort?: "newest" | "oldest" | undefined;
            status?: "draft" | "confirmed" | "shipped" | "completed" | "cancelled" | undefined;
            from?: string | undefined;
            to?: string | undefined;
            limit?: number | undefined;
            cursor?:
              | {
                  createdAt: string;
                  id: string;
                }
              | undefined;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & {
              paymentStatus?: string | null | undefined;
              statusLabel?: string | undefined;
            } & zod.$brand<"OrderListItemDto">
          >[];
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
        create: _trpc_server.TRPCMutationProcedure<{
          input: {
            service: "business" | "customer";
            lines: {
              sku: string;
              name: string;
              quantity: number;
              unitPrice: number;
            }[];
            draft?: boolean | undefined;
          };
          output: Readonly<
            {
              id: string;
              tenantId: string;
              customerId: string;
              status: "draft" | "confirmed" | "shipped" | "completed" | "cancelled";
              lines: Readonly<{
                sku: string;
                name: string;
                quantity: number;
                unitPrice: number;
              }>[];
              total: number;
              createdAt: string;
              version: number;
              reservationId: string | null;
            } & zod.$brand<"CreateOrderOutputDto">
          >;
          meta: {
            standalone?: boolean;
            public?: boolean;
          };
        }>;
      }>
    >;
  }>
>;
type AppRouter = typeof appRouter;
type RouterInputs = inferRouterInputs<AppRouter>;
type RouterOutputs = inferRouterOutputs<AppRouter>;

export type { AppRouter, RouterInputs, RouterOutputs };
