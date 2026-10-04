"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderInline = (text: string): React.ReactNode => {
    // Parse links, bold, italic, code
    const parts: React.ReactNode[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderFormatting(text.slice(lastIndex, match.index)));
      }
      const label = match[1];
      const url = match[2];
      parts.push(
        <a
          key={`link-${match.index}`}
          href={url}
          target={url.startsWith("http") ? "_blank" : undefined}
          rel={url.startsWith("http") ? "noopener noreferrer" : undefined}
          className="text-signal underline underline-offset-4 hover:text-signal/80 transition-colors"
        >
          {label}
        </a>,
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(renderFormatting(text.slice(lastIndex)));
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const renderFormatting = (text: string): React.ReactNode => {
    // Process code, bold, italic
    const tokens: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIdx = 0;
    let m;

    while ((m = regex.exec(text)) !== null) {
      if (m.index > lastIdx) {
        tokens.push(text.slice(lastIdx, m.index));
      }
      const token = m[1];
      if (token.startsWith("`") && token.endsWith("`")) {
        tokens.push(
          <code
            key={`c-${m.index}`}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-signal font-medium"
          >
            {token.slice(1, -1)}
          </code>,
        );
      } else if (token.startsWith("**") && token.endsWith("**")) {
        tokens.push(
          <strong key={`b-${m.index}`} className="font-semibold text-foreground">
            {token.slice(2, -2)}
          </strong>,
        );
      } else if (token.startsWith("*") && token.endsWith("*")) {
        tokens.push(
          <em key={`i-${m.index}`} className="italic text-muted-foreground">
            {token.slice(1, -1)}
          </em>,
        );
      }
      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      tokens.push(text.slice(lastIdx));
    }

    return tokens.length === 1 ? tokens[0] : <>{tokens}</>;
  };

  // Split lines and parse blocks
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];
  let inList = false;
  let listItems: string[] = [];
  let listType: "ul" | "ol" = "ul";

  const flushList = (key: number) => {
    if (!inList) return;
    if (listType === "ul") {
      blocks.push(
        <ul key={`ul-${key}`} className="my-3 ms-6 list-disc space-y-1.5 text-muted-foreground">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
    } else {
      blocks.push(
        <ol key={`ol-${key}`} className="my-3 ms-6 list-decimal space-y-1.5 text-muted-foreground">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
    }
    inList = false;
    listItems = [];
  };

  const flushTable = (key: number) => {
    if (!inTable) return;
    blocks.push(
      <div key={`table-${key}`} className="my-5 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {tableHeader.map((th, i) => (
                <th key={i} className="px-4 py-2.5 font-medium">
                  {renderInline(th)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tableRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2.5 text-muted-foreground">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        const fullCode = codeLines.join("\n");
        const blockIdx = i;
        blocks.push(
          <div key={`code-${i}`} className="relative my-4 rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-1.5 text-xs text-muted-foreground font-mono">
              <span>{codeLang || "text"}</span>
              <button
                type="button"
                onClick={() => copyCode(fullCode, blockIdx)}
                className="flex items-center gap-1 rounded px-2 py-1 hover:bg-background transition-colors text-xs"
              >
                {copiedIndex === blockIdx ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-foreground">
              <code>{fullCode}</code>
            </pre>
          </div>,
        );
        inCodeBlock = false;
        codeLines = [];
        codeLang = "";
      } else {
        flushList(i);
        flushTable(i);
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    // Horizontal rule
    if (line === "---" || line === "***") {
      flushList(i);
      flushTable(i);
      blocks.push(<hr key={`hr-${i}`} className="my-6 border-border" />);
      continue;
    }

    // Tables
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!inTable) {
        flushList(i);
        inTable = true;
        tableHeader = cells;
      } else if (cells.every((c) => /^[-:]+$/.test(c))) {
        // Table separator line, skip
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable(i);
    }

    // Headings
    if (line.startsWith("# ")) {
      flushList(i);
      blocks.push(
        <h1 key={`h1-${i}`} className="text-display-md text-foreground font-bold tracking-tight mt-8 mb-4 first:mt-0">
          {renderInline(line.slice(2))}
        </h1>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList(i);
      blocks.push(
        <h2 key={`h2-${i}`} className="text-xl font-semibold tracking-tight text-foreground mt-7 mb-3 border-b border-border pb-2">
          {renderInline(line.slice(3))}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      flushList(i);
      blocks.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold tracking-tight text-foreground mt-5 mb-2">
          {renderInline(line.slice(4))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("#### ")) {
      flushList(i);
      blocks.push(
        <h4 key={`h4-${i}`} className="text-sm font-semibold text-foreground mt-4 mb-2">
          {renderInline(line.slice(5))}
        </h4>,
      );
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      flushList(i);
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="my-3 border-s-4 border-signal/60 bg-muted/20 px-4 py-2 italic text-muted-foreground rounded-e"
        >
          {renderInline(line.slice(2))}
        </blockquote>,
      );
      continue;
    }

    // Lists
    if (/^[-*]\s+/.test(line)) {
      if (!inList || listType !== "ul") {
        flushList(i);
        inList = true;
        listType = "ul";
      }
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      if (!inList || listType !== "ol") {
        flushList(i);
        inList = true;
        listType = "ol";
      }
      listItems.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushList(i);

    // Empty lines
    if (!line) {
      continue;
    }

    // Regular paragraphs
    blocks.push(
      <p key={`p-${i}`} className="my-2.5 text-14px leading-relaxed text-muted-foreground">
        {renderInline(line)}
      </p>,
    );
  }

  flushList(lines.length);
  flushTable(lines.length);

  return <div className={`markdown-body space-y-1 ${className}`}>{blocks}</div>;
}
