export function selectExportFiles(
  app: "api" | "web" | "business" | "admin",
  fileList: string,
  root?: string,
): string[];
export function copyDependencyPatches(destination: string, root?: string): void;
