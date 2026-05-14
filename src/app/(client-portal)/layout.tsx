import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Client Portal — ProjectBill",
  description: "Client portal for ProjectBill",
};

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50 min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
