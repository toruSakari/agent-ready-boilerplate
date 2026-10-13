export type PreviewResources = {
  database: string;
  bucket: string;
  queue: string;
  databaseId: string;
};

export type CloudflareApiCall = (
  path: string,
  method?: string,
  body?: { name?: string; queue_name?: string; sql?: string; params?: readonly unknown[] },
) => Promise<{ result: unknown; result_info?: { total_pages?: number } } | null>;

export function previewResourceNames(id: string): Omit<PreviewResources, "databaseId">;
export function cloudflareApi(
  environment: { CLOUDFLARE_ACCOUNT_ID?: string; CLOUDFLARE_API_TOKEN?: string },
  fetcher?: typeof fetch,
): CloudflareApiCall;
export function provisionPreviewResources(
  id: string,
  api: CloudflareApiCall,
): Promise<PreviewResources>;
export function deletePreviewResources(
  id: string,
  api: CloudflareApiCall,
  deleteObject?: (bucket: string, key: string) => Promise<void>,
): Promise<void>;
