import React, { useState, useEffect } from 'react';

interface Token {
  type:
    | 'keyword'
    | 'function'
    | 'table'
    | 'string'
    | 'number'
    | 'operator'
    | 'punctuation'
    | 'comment'
    | 'plain';
  text: string;
}

/**
 * Tokenize a single line of SQL into syntax tokens (supporting BigQuery SQL dialects)
 */
function tokenizeSqlLine(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  const patterns: { type: Token['type']; regex: RegExp }[] = [
    // Single-line comment (-- or #)
    { type: 'comment', regex: /^(?:--|#).*/ },
    // Multi-line comment (/* ... */)
    { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
    // Backticked table / column identifier (e.g. `vibetube_telemetry.auction_events`)
    { type: 'table', regex: /^`[^`\n]+`/ },
    // String literals (single or double quoted)
    { type: 'string', regex: /^(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/ },
    // Multi-word SQL keywords (must come before single-word keywords)
    {
      type: 'keyword',
      regex: /^\b(?:GROUP\s+BY|ORDER\s+BY|PARTITION\s+BY|CLUSTER\s+BY)\b/i,
    },
    // Standard SQL & BigQuery keywords
    {
      type: 'keyword',
      regex:
        /^\b(?:SELECT|FROM|WHERE|LIMIT|AS|AND|OR|NOT|IN|IS|ON|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|UNION|ALL|DESC|ASC|WITH|OVER|CASE|WHEN|THEN|ELSE|END|DISTINCT|OFFSET|NULL|TRUE|FALSE|HAVING|BETWEEN|LIKE|EXISTS|ANY|SOME)\b/i,
    },
    // Known SQL & BigQuery aggregate, math, date/time, and analytics functions
    {
      type: 'function',
      regex:
        /^\b(?:COUNT|AVG|ROUND|SUM|MIN|MAX|STDDEV|APPROX_QUANTILES|TIMESTAMP_TRUNC|TIMESTAMP_ADD|TIMESTAMP_SUB|EXTRACT|DATE|DATETIME|TIME|TIMESTAMP|IF|COALESCE|GREATEST|LEAST|FORMAT_DATE|GENERATE_ARRAY|GENERATE_DATE_ARRAY|UNNEST|DATE_DIFF|FLOOR|RAND|CAST|CONCAT|STRING|INT64|FLOAT64|ROW_NUMBER|DENSE_RANK|RANK)\b/i,
    },
    // General function call: identifier followed by '('
    { type: 'function', regex: /^[a-zA-Z_]\w*(?=\s*\()/ },
    // Numbers (integers, floats)
    { type: 'number', regex: /^\b\d+(?:\.\d+)?\b/ },
    // Operators
    { type: 'operator', regex: /^(?:!=|<=|>=|<>|==|[=<>+\-*/%])/ },
    // Punctuation
    { type: 'punctuation', regex: /^[(),;.]/ },
    // Plain identifiers / column names
    { type: 'plain', regex: /^[a-zA-Z_]\w*/ },
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

/**
 * Token styling with high-contrast light and glowing dark palettes
 */
function getTokenStyle(type: Token['type'], isLight: boolean): React.CSSProperties {
  if (isLight) {
    switch (type) {
      case 'keyword':
        return { color: '#6b21a8', fontWeight: 700 }; // Deep Violet
      case 'function':
        return { color: '#0284c7', fontWeight: 700 }; // Rich Sky Blue
      case 'table':
        return { color: '#059669', fontWeight: 600 }; // Emerald Green
      case 'string':
        return { color: '#b45309', fontWeight: 600 }; // Deep Amber/Rust
      case 'number':
        return { color: '#dc2626', fontWeight: 600 }; // Crimson
      case 'operator':
        return { color: '#0f766e', fontWeight: 700 }; // Deep Teal
      case 'punctuation':
        return { color: '#475569', fontWeight: 500 }; // Slate
      case 'comment':
        return { color: '#64748b', fontStyle: 'italic' }; // Muted Slate
      case 'plain':
      default:
        return { color: '#0f172a', fontWeight: 500 }; // Dark Slate
    }
  }

  // Dark Theme Palette
  switch (type) {
    case 'keyword':
      return { color: '#c084fc', fontWeight: 700 }; // Purple / Violet
    case 'function':
      return { color: '#38bdf8', fontWeight: 600 }; // Bright Cyan
    case 'table':
      return { color: '#34d399', fontWeight: 600 }; // Vibrant Emerald
    case 'string':
      return { color: '#fbbf24', fontWeight: 500 }; // Warm Gold
    case 'number':
      return { color: '#f87171', fontWeight: 500 }; // Soft Red / Coral
    case 'operator':
      return { color: '#67e8f9', fontWeight: 600 }; // Teal / Cyan
    case 'punctuation':
      return { color: '#94a3b8', fontWeight: 500 }; // Slate
    case 'comment':
      return { color: '#64748b', fontStyle: 'italic' }; // Muted Gray
    case 'plain':
    default:
      return { color: '#f1f5f9', fontWeight: 500 }; // Crisp Light Foreground
  }
}

interface SqlCodeHighlightProps {
  code: string;
  showLineNumbers?: boolean;
  className?: string;
}

export default function SqlCodeHighlight({
  code,
  showLineNumbers = true,
  className = '',
}: SqlCodeHighlightProps) {
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

  const lines = code.trim().split('\n');
  const lineCount = lines.length;

  return (
    <div
      className={`rounded-xl border overflow-hidden flex text-xs sm:text-[13px] font-mono shadow-inner ${
        isLight ? 'bg-slate-100/90 border-slate-300' : 'bg-black/50 border-hairline/50'
      } ${className}`}
    >
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

      <pre className="p-3.5 leading-[1.625rem] overflow-x-auto whitespace-pre flex-1 m-0 font-medium">
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
  );
}
