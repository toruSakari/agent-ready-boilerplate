import { frontendConfig } from "@dev-template/config/frontend";

// アプリの配備単位は維持し、TanStack Start・Cloudflareの技術設定だけを共有する。
export default frontendConfig("admin", import.meta.url);
