"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface AIMessageBubbleProps {
  content: string;
  role: "user" | "assistant" | "system";
  isStreaming?: boolean;
}

export function AIMessageBubble({ content, role, isStreaming }: AIMessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "rounded-lg px-3 py-2 max-w-[90%]",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
      )}>
        <div className={cn(
          "text-sm prose prose-sm max-w-none",
          isUser && "text-primary-foreground",
          "markdown-custom",
        )}>
          <ReactMarkdown
            rehypePlugins={[rehypeSanitize]}
            components={{
              // Code blocks
              code({ className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match && !String(children).includes("\n");
                if (isInline) {
                  return (
                    <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="bg-muted/30 p-3 rounded-md overflow-x-auto text-xs font-mono my-2">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
              // Style lists inside AI bubbles
              ul({ children, ...props }) {
                return (
                  <ul className="list-disc ml-4 my-1 space-y-0.5" {...props}>
                    {children}
                  </ul>
                );
              },
              ol({ children, ...props }) {
                return (
                  <ol className="list-decimal ml-4 my-1 space-y-0.5" {...props}>
                    {children}
                  </ol>
                );
              },
              // Style paragraphs
              p({ children, ...props }) {
                return (
                  <p className="text-sm leading-relaxed my-1" {...props}>
                    {children}
                  </p>
                );
              },
              // Style tables
              table({ children, ...props }) {
                return (
                  <div className="overflow-x-auto my-2">
                    <table className="text-xs border-collapse w-full" {...props}>
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children, ...props }) {
                return (
                  <th className="border border-border px-2 py-1 text-left font-semibold" {...props}>
                    {children}
                  </th>
                );
              },
              td({ children, ...props }) {
                return (
                  <td className="border border-border px-2 py-1" {...props}>
                    {children}
                  </td>
                );
              },
              // Style headings
              h1({ children, ...props }) {
                return <h1 className="text-base font-bold mt-2 mb-1" {...props}>{children}</h1>;
              },
              h2({ children, ...props }) {
                return <h2 className="text-sm font-semibold mt-2 mb-1" {...props}>{children}</h2>;
              },
              h3({ children, ...props }) {
                return <h3 className="text-sm font-semibold mt-1 mb-0.5" {...props}>{children}</h3>;
              },
              h4({ children, ...props }) {
                return <h4 className="text-sm font-medium mt-1 mb-0.5" {...props}>{children}</h4>;
              },
              blockquote({ children, ...props }) {
                return (
                  <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground my-1" {...props}>
                    {children}
                  </blockquote>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {isStreaming && (
          <div className="flex gap-1 mt-2">
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
    </div>
  );
}
