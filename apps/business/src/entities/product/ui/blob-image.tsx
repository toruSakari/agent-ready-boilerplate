"use client";
import { useEffect, useRef } from "react";

export function BlobImage(props: { blob: Blob; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // キャッシュにはBlobを残し、Object URLは描画ごとに所有・解放する。再表示で解放済みURLを使わない。
    const url = URL.createObjectURL(props.blob);
    const image = imageRef.current;
    if (image) {
      image.src = url;
    }

    return () => URL.revokeObjectURL(url);
  }, [props.blob]);
  return <img ref={imageRef} alt={props.alt} className="h-full w-full object-contain" />;
}
