"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AppNav } from "./app-nav";
import { BrandLogo } from "./brand-logo";

/** Slide-in nav drawer for viewports below `sm`, where the desktop sidebar is hidden. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open navigation" />}
      >
        <Menu className="size-5" />
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="top-0 left-0 h-full max-w-64 translate-x-0 translate-y-0 content-start gap-6 overflow-y-auto rounded-none p-4 sm:max-w-64"
      >
        <DialogTitle className="sr-only">Navigation</DialogTitle>
        <DialogDescription className="sr-only">Jump to any section of StockLens.</DialogDescription>
        <BrandLogo />
        <AppNav onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
