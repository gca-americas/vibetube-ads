import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface Token {
  type:
    | 'keyword'
    | 'function'
    | 'string'
    | 'number'
    | 'operator'
    | 'punctuation'
    | 'comment'
    | 'column'
    | 'table'
    | 'plain';
  text: string;
}

/**
 * Tokenize a single line of BigQuery Standard SQL
 */
function tokenizeSqlLine(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  const patterns: { type: Token['type']; regex: RegExp }[] = [
    // Comments (-- or /* */)
    { type: 'comment', regex: /^(--.*|\/\*[\s\S]*?\*\/)/ },
    // Table references with backticks `project.dataset.table`
    { type: 'table', regex: /^`[^`]+`/ },
    // Strings in single or double quotes
    { type: 'string', regex: /^(?:"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/ },
    // Numbers
    { type: 'number', regex: /^\b\d+(?:\.\d+)?\b/ },
    // Major SQL Keywords
    {
      type: 'keyword',
      regex: /^\b(?:SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING|AS|AND|OR|NOT|IN|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END|INTERVAL|MINUTE|HOUR|DAY|TIMESTAMP|DESC|ASC|OFFSET)\b/i,
    },
    // SQL / BigQuery Functions
    {
      type: 'function',
      regex: /^\b(?:COUNT|AVG|SUM|MIN|MAX|ROUND|SAFE_DIVIDE|APPROX_QUANTILES|TIMESTAMP_TRUNC|TIMESTAMP_SUB|CURRENT_TIMESTAMP|GENERATE_UUID|IFNULL|COALESCE|CONCAT|SUBSTR|CAST)\b/i,
    },
    // Operators
    { type: 'operator', regex: /^(?:>=|<=|!=|<>|=|>|<|\+|-|\*|\/|%|\|\|)/ },
    // Punctuation & Brackets
    { type: 'punctuation', regex: /^[()\[\],;.]/ },
    // Plain identifiers / column names
    { type: 'column', regex: /^[a-zA-Z_]\w*/ },
    // Whitespace
    { type: 'plain', regex: /^\s+/ },
    // Fallback single character
    { type: 'plain', regex: /^./ },
  ];

  while (remaining.length > 0) {
    let matched = false;
    for (const { type, regex } of patterns) {
      const match = remaining.match(regex);
      if (match && match[0].length > 0) {
        tokens.push({ type, text: match[0] });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push({ type: 'plain', text: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

function getTokenStyle(type: Token['type'], isLight: boolean): React.CSSProperties {
  if (isLight) {
    switch (type) {
      case 'keyword':
        return { color: '#7c3aed', fontWeight: 700 }; // Rich Purple
      case 'function':
        return { color: '#0284c7', fontWeight: 600 }; // Sky Blue
      case 'table':
        return { color: '#059669', fontWeight: 600 }; // Emerald
      case 'column':
        return { color: '#0f172a', fontWeight: 500 }; // Charcoal
      case 'string':
        return { color: '#d97706', fontWeight: 500 }; // Amber
      case 'number':
        return { color: '#dc2626', fontWeight: 600 }; // Crimson
      case 'operator':
        return { color: '#2563eb', fontWeight: 600 }; // Blue
      case 'comment':
        return { color: '#64748b', fontStyle: 'italic' }; // Muted Slate
      case 'punctuation':
        return { color: '#475569' };
      default:
        return { color: '#0f172a' };
    }
  }

  // Dark Mode High Contrast Palette
  switch (type) {
    case 'keyword':
      return { color: '#c084fc', fontWeight: 700 }; // Bright Purple
    case 'function':
      return { color: '#38bdf8', fontWeight: 600 }; // Cyan Blue
    case 'table':
      return { color: '#34d399', fontWeight: 600 }; // Vibrant Emerald
    case 'column':
      return { color: '#f1f5f9', fontWeight: 500 }; // Bright Zinc
    case 'string':
      return { color: '#fcd34d', fontWeight: 500 }; // Warm Gold
    case 'number':
      return { color: '#fb7185', fontWeight: 600 }; // Rose / Coral
    case 'operator':
      return { color: '#60a5fa', fontWeight: 600 }; // Blue
    case 'comment':
      return { color: '#94a3b8', fontStyle: 'italic' }; // Muted Slate
    case 'punctuation':
      return { color: '#64748b' };
    default:
      return { color: '#f8fafc' };
  }
}

interface SqlCodeHighlightProps {
  code: string;
  className?: string;
  showLineNumbers?: boolean;
}

export default function SqlCodeHighlight({
  code,
  className = '',
  showLineNumbers = true,
}: SqlCodeHighlightProps) {
  const [copied, setCopied] = useState(false);
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

    const observer = new MutationObserver(() => checkTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy SQL:', e);
    }
  };

  const lines = code.trim().split('\n');

  return (
    <div
      className={`flex flex-col rounded-2xl border transition-all overflow-hidden font-mono text-xs ${
        isLight
          ? 'bg-slate-50 border-slate-200 shadow-lg'
          : 'bg-[#0a0a12] border-white/10 shadow-2xl'
      } ${className}`}
    >
      {/* Header bar */}
      <div
        className={`shrink-0 px-4 py-2.5 border-b flex items-center justify-between text-xs transition-colors ${
          isLight
            ? 'bg-slate-100 border-slate-200 text-slate-900'
            : 'bg-[#12121e] border-white/10 text-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Terminal size={14} className={isLight ? 'text-blue-600' : 'text-vibe-cyan'} />
          <span className="font-semibold tracking-wide">BigQuery Standard SQL</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`p-1.5 px-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] cursor-pointer ${
            isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
          }`}
          title="Copy SQL"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-500" />
              <span className="text-emerald-600 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy SQL</span>
            </>
          )}
        </button>
      </div>

      {/* Code viewport with line numbers */}
      <div className="flex items-stretch text-xs flex-1 min-h-0 overflow-y-auto overflow-x-auto">
        {showLineNumbers && (
          <div
            className={`select-none py-4 pr-3 pl-4 text-right font-mono text-[11px] border-r shrink-0 ${
              isLight
                ? 'border-slate-200 text-indigo-600 font-semibold bg-slate-100/60'
                : 'border-white/5 text-purple-400/60 bg-[#08080e]'
            }`}
          >
            {lines.map((_, idx) => (
              <div key={idx} className="leading-[1.625rem]">
                {idx + 1}
              </div>
            ))}
          </div>
        )}

        <pre className="m-0 p-4 font-mono text-xs leading-[1.625rem] whitespace-pre overflow-x-auto flex-1 font-medium">
          <code>
            {lines.map((lineStr, lineIdx) => {
              const tokens = tokenizeSqlLine(lineStr);
              return (
                <div key={lineIdx} className="leading-[1.625rem]">
                  {tokens.length === 0 ? (
                    '\u00A0'
                  ) : (
                    tokens.map((token, tokenIdx) => (
                      <span key={tokenIdx} style={getTokenStyle(token.type, isLight)}>
                        {token.text}
                      </span>
                    ))
                  )}
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
