"use client";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

// 確認操作のARIA・フォーカス制御は公式shadcn/uiとRadixの契約に委ねる。
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogPortal = AlertDialogPrimitive.Portal;
export { AlertDialogOverlay } from "@dev-template/ui/alert-dialog-overlay";
export { AlertDialogContent } from "@dev-template/ui/alert-dialog-content";
export { AlertDialogHeader } from "@dev-template/ui/alert-dialog-header";
export { AlertDialogFooter } from "@dev-template/ui/alert-dialog-footer";
export { AlertDialogTitle } from "@dev-template/ui/alert-dialog-title";
export { AlertDialogDescription } from "@dev-template/ui/alert-dialog-description";
export { AlertDialogAction } from "@dev-template/ui/alert-dialog-action";
export { AlertDialogCancel } from "@dev-template/ui/alert-dialog-cancel";
