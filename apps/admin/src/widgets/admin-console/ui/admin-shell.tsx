"use client";
import { AdminHeader } from "#admin/widgets/admin-console/ui/admin-header.tsx";
import { AdminSidebar } from "#admin/widgets/admin-console/ui/admin-sidebar.tsx";
import { useState } from "react";
import type { ReactNode } from "react";

export function AdminShell(props: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminHeader open={open} onToggle={() => setOpen(!open)} />
      <div className="mx-auto flex max-w-[1600px]">
        <AdminSidebar open={open} onClose={() => setOpen(false)} />
        <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">{props.children}</main>
      </div>
    </div>
  );
}
