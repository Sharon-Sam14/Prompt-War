"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AuroraProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function AuroraBackground({ children, className, ...props }: AuroraProps) {
  return (
    <div
      className={cn("relative overflow-hidden bg-background text-foreground", className)}
      {...props}
    >
      <div className="aurora-backdrop" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
