import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTRPC } from "@dev-template/client/api";
import { productInputSchema, useRefreshProducts } from "#business/entities/product/index.ts";
import type { Product } from "#business/entities/product/index.ts";

const schema = productInputSchema.pick({ name: true, unitPrice: true });

export function useUpdateProductForm(product: Product) {
  const trpc = useTRPC();
  const refresh = useRefreshProducts();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: product.name, unitPrice: product.unitPrice },
  });
  const update = useMutation(trpc.product.update.mutationOptions({ onSuccess: refresh }));
  const pending = update.isPending || form.formState.isSubmitting;
  async function submit(value: { name: string; unitPrice: number }) {
    try {
      await update.mutateAsync({
        id: product.id,
        ...value,
        expectedName: product.name,
        expectedUnitPrice: product.unitPrice,
      });
    } catch {
      /* 更新失敗でも入力を保持する。競合時はAPIが保存を拒否する。 */
    }
  }
  return { form, update, pending, submit };
}
