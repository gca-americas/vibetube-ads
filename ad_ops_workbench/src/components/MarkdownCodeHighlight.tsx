import React, { useState, useEffect } from 'react';
import { Copy, Check, FileText } from 'lucide-react';

interface Token {
  type:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'bullet'
    | 'number'
    | 'bold'
    | 'italic'
    | 'code'
    | 'code_block'
    | 'code_fence'
    | 'blockquote'
    | 'link'
    | 'hr'
    | 'plain';
  text: string;
}

function tokenizeInline(text: string, contextType: Token['type'], tokens: Token[]) {
  let rem = text;
  while (rem.length > 0) {
    // Inline code: `code`
    const codeMatch = rem.match(/^`[^`\n]+`/);
    if (codeMatch) {
      tokens.push({ type: 'code', text: codeMatch[0] });
      rem = rem.slice(codeMatch[0].length);
      continue;
    }

    // Bold + Italic: ***text*** or ___text___
    const boldItalicMatch = rem.match(/^(?:\*\*\*[^*]+?\*\*\*|___[^_]+?___)/);
    if (boldItalicMatch) {
      tokens.push({ type: 'bold', text: boldItalicMatch[0] });
      rem = rem.slice(boldItalicMatch[0].length);
      continue;
    }

    // Bold: **text** or __text__
    const boldMatch = rem.match(/^(?:\*\*([^*]+?)\*\*|__([^_]+?)__)/);
    if (boldMatch) {
      tokens.push({ type: 'bold', text: boldMatch[0] });
      rem = rem.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = rem.match(/^(?:\*([^*]+?)\*|_([^_]+?)_)/);
    if (italicMatch) {
      tokens.push({ type: 'italic', text: italicMatch[0] });
      rem = rem.slice(italicMatch[0].length);
      continue;
    }

    // Link: [text](url)
    const linkMatch = rem.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push({ type: 'link', text: linkMatch[0] });
      rem = rem.slice(linkMatch[0].length);
      continue;
    }

    // Text chunk until next special markdown delimiter
    const textChunkMatch = rem.match(/^[^`*_\[\n]+/);
    if (textChunkMatch) {
      tokens.push({ type: contextType, text: textChunkMatch[0] });
      rem = rem.slice(textChunkMatch[0].length);
      continue;
    }

    // Fallback single character
    tokens.push({ type: contextType, text: rem[0] });
    rem = rem.slice(1);
  }
}

function tokenizeMarkdownLine(
  line: string,
  inCodeFence: boolean
): { tokens: Token[]; nextInCodeFence: boolean } {
  // Code block fence (e.g. ``` or ```python)
  if (/^\s*```/.test(line)) {
    return {
      tokens: [{ type: 'code_fence', text: line }],
      nextInCodeFence: !inCodeFence,
    };
  }

  // Inside code fence: render as code_block
  if (inCodeFence) {
    return {
      tokens: [{ type: 'code_block', text: line }],
      nextInCodeFence: true,
    };
  }

  // Horizontal rule: --- or ***
  if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
    return {
      tokens: [{ type: 'hr', text: line }],
      nextInCodeFence: false,
    };
  }

  const tokens: Token[] = [];
  let remaining = line;

  // Header line (e.g. # , ## , ### , #### )
  const headerMatch = remaining.match(/^(#{1,6}\s+)/);
  if (headerMatch) {
    const level = headerMatch[1].trim().length;
    const type: Token['type'] =
      level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4';
    tokens.push({ type, text: headerMatch[1] });
    remaining = remaining.slice(headerMatch[1].length);
    tokenizeInline(remaining, type, tokens);
    return { tokens, nextInCodeFence: false };
  }

  // Blockquote line (e.g. > )
  const quoteMatch = remaining.match(/^(>\s*)/);
  if (quoteMatch) {
    tokens.push({ type: 'blockquote', text: quoteMatch[1] });
    remaining = remaining.slice(quoteMatch[1].length);
    tokenizeInline(remaining, 'blockquote', tokens);
    return { tokens, nextInCodeFence: false };
  }

  // Bullet list line (e.g. - , * , + )
  const bulletMatch = remaining.match(/^(\s*[-*+]\s+)/);
  if (bulletMatch) {
    tokens.push({ type: 'bullet', text: bulletMatch[1] });
    remaining = remaining.slice(bulletMatch[1].length);
    tokenizeInline(remaining, 'plain', tokens);
    return { tokens, nextInCodeFence: false };
  }

  // Numbered list line (e.g. 1. , 2. )
  const numberMatch = remaining.match(/^(\s*\d+\.\s+)/);
  if (numberMatch) {
    tokens.push({ type: 'number', text: numberMatch[1] });
    remaining = remaining.slice(numberMatch[1].length);
    tokenizeInline(remaining, 'plain', tokens);
    return { tokens, nextInCodeFence: false };
  }

  // Normal paragraph line
  tokenizeInline(remaining, 'plain', tokens);
  return { tokens, nextInCodeFence: false };
}

function getTokenStyle(type: Token['type'], isLight: boolean): React.CSSProperties {
  if (isLight) {
    switch (type) {
      case 'h1':
        return { color: '#581c87', fontWeight: 800 }; // Deep Purple
      case 'h2':
        return { color: '#0369a1', fontWeight: 700 }; // Deep Sky Blue
      case 'h3':
        return { color: '#047857', fontWeight: 700 }; // Deep Emerald
      case 'h4':
        return { color: '#b45309', fontWeight: 700 }; // Deep Amber
      case 'bullet':
        return { color: '#0284c7', fontWeight: 700 }; // Rich Cyan
      case 'number':
        return { color: '#d97706', fontWeight: 700 }; // Warm Gold
      case 'bold':
        return { color: '#0f172a', fontWeight: 700 }; // Jet Black
      case 'italic':
        return { color: '#334155', fontStyle: 'italic' }; // Slate
      case 'code':
        return {
          color: '#c2410c',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          padding: '1px 5px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontWeight: 600,
        };
      case 'code_block':
        return { color: '#0f766e', fontFamily: 'monospace' }; // Deep Teal
      case 'code_fence':
        return { color: '#64748b', fontWeight: 700, fontFamily: 'monospace' };
      case 'blockquote':
        return { color: '#059669', fontStyle: 'italic' }; // Emerald
      case 'link':
        return { color: '#2563eb', textDecoration: 'underline' };
      case 'hr':
        return { color: '#94a3b8', fontWeight: 700 };
      case 'plain':
      default:
        return { color: '#1e293b', fontWeight: 500 };
    }
  }

  // Dark Theme Palette
  switch (type) {
    case 'h1':
      return { color: '#c084fc', fontWeight: 800 }; // Purple / Violet
    case 'h2':
      return { color: '#38bdf8', fontWeight: 700 }; // Cyan / Sky Blue
    case 'h3':
      return { color: '#34d399', fontWeight: 700 }; // Vibrant Emerald
    case 'h4':
      return { color: '#fbbf24', fontWeight: 700 }; // Gold
    case 'bullet':
      return { color: '#67e8f9', fontWeight: 700 }; // Neon Cyan
    case 'number':
      return { color: '#fbbf24', fontWeight: 700 }; // Gold
    case 'bold':
      return { color: '#f8fafc', fontWeight: 700 }; // Crisp White
    case 'italic':
      return { color: '#cbd5e1', fontStyle: 'italic' }; // Light Slate
    case 'code':
      return {
        color: '#fb923c',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        padding: '1px 5px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontWeight: 600,
      };
    case 'code_block':
      return { color: '#67e8f9', fontFamily: 'monospace' }; // Cyan code
    case 'code_fence':
      return { color: '#94a3b8', fontWeight: 700, fontFamily: 'monospace' };
    case 'blockquote':
      return { color: '#a7f3d0', fontStyle: 'italic' };
    case 'link':
      return { color: '#60a5fa', textDecoration: 'underline' };
    case 'hr':
      return { color: '#64748b', fontWeight: 700 };
    case 'plain':
    default:
      return { color: '#e2e8f0', fontWeight: 500 };
  }
}

interface MarkdownCodeHighlightProps {
  code: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export default function MarkdownCodeHighlight({
  code,
  filename = 'judge_critique.md',
  showLineNumbers = true,
  className = '',
}: MarkdownCodeHighlightProps) {
  const [copied, setCopied] = useState(false);

  // Theme Detection (Dark vs Light mode)
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('light');
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkTheme = () => {
      setIsLight(document.documentElement.classList.contains('light'));
    };
    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  const lines = code.trim().split('\n');
  const lineCount = lines.length;

  // Process lines and track code fence state across lines
  let inCodeFence = false;
  const tokenizedLines: Token[][] = lines.map(line => {
    const result = tokenizeMarkdownLine(line, inCodeFence);
    inCodeFence = result.nextInCodeFence;
    return result.tokens;
  });

  return (
    <div
      className={`rounded-2xl border overflow-hidden flex flex-col font-mono text-xs sm:text-[13px] shadow-2xl transition-all ${
        isLight
          ? 'bg-slate-50 border-slate-300'
          : 'bg-[#0f0f18] border-white/10'
      } ${className}`}
    >
      {/* Code Header Bar */}
      <div
        className={`shrink-0 px-4 py-2.5 border-b flex items-center justify-between text-xs transition-colors ${
          isLight
            ? 'bg-slate-100 border-slate-200 text-slate-900'
            : 'border-white/10 text-zinc-200'
        }`}
        style={{ backgroundColor: isLight ? '#f1f5f9' : '#1e1e2d' }}
      >
        <div className="flex items-center gap-2">
          <FileText size={15} style={{ color: isLight ? '#7c3aed' : '#c084fc' }} />
          <span className={`font-semibold tracking-wide ${isLight ? 'text-slate-900' : 'text-zinc-200'}`}>
            {filename}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold">
            Markdown
          </span>
        </div>

        <button
          type="button"
          onClick={copyToClipboard}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer ${
            copied
              ? 'bg-emerald-500 text-black font-bold shadow-sm'
              : isLight
              ? 'bg-white hover:bg-slate-200 text-slate-800 border border-slate-300'
              : 'bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10'
          }`}
          title="Copy Markdown output"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="flex overflow-hidden max-h-[520px]">
        {showLineNumbers && (
          <div
            className={`select-none py-3.5 pr-3 pl-3.5 text-right font-mono text-xs border-r shrink-0 overflow-hidden ${
              isLight
                ? 'border-slate-300 text-slate-400 font-bold bg-slate-200/50'
                : 'border-white/5 text-slate-500/70 bg-white/[0.02]'
            }`}
          >
            {Array.from({ length: lineCount }).map((_, idx) => (
              <div key={idx} className="leading-[1.625rem]">
                {idx + 1}
              </div>
            ))}
          </div>
        )}

        <pre className="p-3.5 leading-[1.625rem] overflow-x-auto overflow-y-auto whitespace-pre flex-1 m-0 font-medium">
          <code>
            {tokenizedLines.map((lineTokens, lineIdx) => (
              <div key={lineIdx} className="leading-[1.625rem]">
                {lineTokens.length === 0 ? (
                  <span>&nbsp;</span>
                ) : (
                  lineTokens.map((token, tokIdx) => (
                    <span
                      key={tokIdx}
                      style={getTokenStyle(token.type, isLight)}
                    >
                      {token.text}
                    </span>
                  ))
                )}
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
