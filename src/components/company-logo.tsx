/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";

export function CompanyLogo({
  src,
  companyName,
}: {
  src: string;
  companyName: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div>
      {!failed && (
        <img
          src={src}
          alt={companyName}
          className="h-12 w-auto mb-2 object-contain"
          onError={() => setFailed(true)}
        />
      )}
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">
        {companyName}
      </h1>
    </div>
  );
}
