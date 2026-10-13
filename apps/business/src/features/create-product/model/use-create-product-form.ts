import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRefreshProducts } from "#business/entities/product/index.ts";
import type { CreateProductInput } from "#business/entities/product/index.ts";
import { DEFAULT_PRODUCT_UNIT_PRICE } from "#business/features/create-product/model/form-defaults.ts";
import { createProductSchema } from "#business/features/create-product/model/form-schema.ts";
import { useTRPC } from "@dev-template/client/api";

/** 保存・入力保持・作成後遷移の契約を表示から分離する。 */
export function useCreateProductForm(onCreated?: (id: string) => Promise<void>) {
  const trpc = useTRPC();
  const refresh = useRefreshProducts();
  const form = useForm({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      sku: "",
      name: "",
      unitPrice: DEFAULT_PRODUCT_UNIT_PRICE,
      initialStock: Number.NaN,
    },
  });
  const create = useMutation(trpc.product.create.mutationOptions({ onSuccess: refresh }));
  const pending = create.isPending || form.formState.isSubmitting;
  async function submit(input: CreateProductInput) {
    try {
      const created = await create.mutateAsync(input);
      if (onCreated) {
        await onCreated(created.id);
        return;
      }

      // 次の商品を続けて登録できるよう価格は残し、重複しやすいSKUと商品名だけを成功後に空にする。
      form.reset({ ...input, sku: "", name: "" });
    } catch {
      // Mutationのエラーを下部に表示し、修正・再送できるよう入力はそのまま残す。
    }
  }
  return { form, create, pending, submit };
}
