import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getClientProjectSow } from "@/lib/client-portal-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SowPrintButton } from "./print-button";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { format } from "date-fns";

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
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Statement of Work — {sow.title}</h1>
        <SowPrintButton />
      </div>
      <Card className="print:border-0 print:shadow-none">
        <CardHeader><CardTitle>{sow.title}</CardTitle></CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeSanitize]}>
            {sow.terms}
          </ReactMarkdown>
          {sow.termsAcceptedAt && (
            <div className="mt-6 pt-4 border-t text-xs text-muted-foreground space-y-1 not-prose">
              <div>Accepted by: {sow.clientName}</div>
              <div>Accepted at: {format(new Date(sow.termsAcceptedAt), "dd MMM yyyy HH:mm")}</div>
              {sow.termsAcceptedUserAgent && (
                <div className="break-all">User agent: {sow.termsAcceptedUserAgent}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}