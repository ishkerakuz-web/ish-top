import React, { useEffect, useId, useState } from "react";


/** Bo'limlar orasidagi havola (TabLink). */

export function TabLink({
  href,
  onNavigate,
  className = "",
  children,
  ...rest
}: {
  href: string;
  onNavigate: () => void;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate();
      }}
      className={className}
      {...rest}
    >
      {children}
    </a>
  );
}
