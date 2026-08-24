"use client";

import { Button } from "@/components/ui/button";

export function SowPrintButton() {
  return <Button variant="outline" size="sm" onClick={() => window.print()}>Print / Save as PDF</Button>;
}