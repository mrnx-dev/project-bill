import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientProjectSow } from "@/lib/client-portal-queries";
import { Card, CardContent } from "@/components/ui/card";
import { SowPrintButton } from "./print-button";
import { ContractDocument } from "@/components/contract-document";

export default async function PortalProjectSowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getClientSession();
  if (!session) notFound(); // proxy guarantees a cookie; defensive
  const { id } = await params;
  const sow = await getClientProjectSow(session, id);
  if (!sow) notFound();

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Plain <style>, not styled-jsx: Server Components cannot import styled-jsx (client-only). */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 2cm;
          }
          body {
            background: white;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Statement of Work — {sow.title}</h1>
        <SowPrintButton />
      </div>
      <Card className="print:border-0 print:shadow-none bg-white">
        <CardContent>
          <ContractDocument {...sow} />
        </CardContent>
      </Card>
    </div>
  );
}
