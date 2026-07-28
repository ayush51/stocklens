"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeTicker } from "@/features/companies/lib/normalize-ticker";
import { Input } from "@/components/ui/input";

export function CompanySearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = normalizeTicker(value);
    if (!ticker) return;
    router.push(`/companies/${encodeURIComponent(ticker)}`);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Look up a ticker (e.g. AAPL)"
        aria-label="Look up a company by ticker"
      />
    </form>
  );
}
