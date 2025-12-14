"use client";

import type { ReactNode } from "react";
import AppLayout from "../(app)/layout";

export default function ProtectedAppLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
