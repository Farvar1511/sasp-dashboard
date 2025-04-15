import * as React from "react";

import { cn } from "../../lib/utils";

export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className={cn("px-4 py-2 bg-blue-500 text-white rounded")}>
      {children}
    </button>
  );
}
