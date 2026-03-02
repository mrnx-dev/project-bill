"use client";

import dynamic from "next/dynamic";

const SetupFormClient = dynamic(
  () => import("./setup-form-client").then((mod) => mod.SetupFormClient),
  { ssr: false },
);

export function SetupClientWrapper() {
  return <SetupFormClient />;
}
