import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Code2, RotateCcw } from 'lucide-react';

interface Token {
  type:
    | 'keyword'
    | 'builtin'
    | 'string'
    | 'number'
    | 'function'
    | 'operator'
    | 'punctuation'
    | 'comment'
    | 'plain';
  text: string;
}

/**
 * Tokenize a single line of Python code into syntax tokens
 */
function tokenizePythonLine(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  const patterns: { type: Token['type']; regex: RegExp }[] = [
    // Comment
    { type: 'comment', regex: /^#.*/ },
    // Strings (triple quotes, double quotes, single quotes, and prefixed f"", r"", b"")
    {
      type: 'string',
      regex: /^(?:[frbFRB]?(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))/,
    },
    // Numbers (hex, binary, float, int)
    {
      type: 'number',
      regex: /^\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    },
    // Keywords
    {
      type: 'keyword',
      regex: /^\b(?:def|class|if|elif|else|while|for|in|return|yield|import|from|as|try|except|finally|with|pass|break|continue|lambda|global|nonlocal|assert|del|raise|async|await)\b/,
    },
    // Built-ins & constants
    {
      type: 'builtin',
      regex: /^\b(?:True|False|None|self|print|len|range|dict|list|set|tuple|int|float|str|bool|sum|min|max|any|all|map|filter|zip|enumerate|isinstance|issubclass|open|type)\b/,
    },
    // Function definition or call (identifier followed by '(')
    { type: 'function', regex: /^[a-zA-Z_]\w*(?=\s*\()/ },
    // Operators (word operators and symbol operators)
    {
      type: 'operator',
      regex: /^(?:\b(?:and|or|not|is)\b|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|\/\/=|\*\*=|<<=|>>=|&=|\|=|\^=|\/\/|\*\*|<<|>>|[+\-*\/%<>=&|^~])/,
    },
    // Punctuation
    { type: 'punctuation', regex: /^[()\[\]{}:,.]/ },
    // Plain identifiers / variables
    { type: 'plain', regex: /^[a-zA-Z_]\w*/ },
    // Whitespace
    { type: 'plain', regex: /^\s+/ },
    // Any single other character fallback
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
 * Token styling with distinct dark and light theme palettes
 */
function getTokenStyle(type: Token['type'], isLight: boolean): React.CSSProperties {
  if (isLight) {
    // Light Theme Syntax Colors (Rich, high-contrast, crisp typography)
    switch (type) {
      case 'keyword':
        return { color: '#7c3aed', fontWeight: 600 }; // Deep Purple
      case 'builtin':
        return { color: '#4f46e5', fontWeight: 500 }; // Indigo
      case 'function':
        return { color: '#0284c7', fontWeight: 600 }; // Sky Blue
      case 'string':
        return { color: '#b45309', fontWeight: 500 }; // Amber/Terracotta
      case 'number':
        return { color: '#dc2626', fontWeight: 500 }; // Crimson
      case 'operator':
        return { color: '#0369a1', fontWeight: 600 }; // Deep Teal
      case 'punctuation':
        return { color: '#334155' }; // Slate
      case 'comment':
        return { color: '#64748b', fontStyle: 'italic' }; // Muted Slate
      case 'plain':
      default:
        return { color: '#0f172a' }; // Dark Charcoal Slate
    }
  }

  // Dark Theme Syntax Colors (Glowing, cybernetic high-contrast palette)
  switch (type) {
    case 'keyword':
      return { color: '#b38cff', fontWeight: 600 }; // Purples Highlight
    case 'builtin':
      return { color: '#8054f0', fontWeight: 500 }; // Purples Base
    case 'function':
      return { color: '#30dfee', fontWeight: 600 }; // Cyans Base
    case 'string':
      return { color: '#ffe6cc' }; // Peaches & Warm Glows
    case 'number':
      return { color: '#ff8f94', fontWeight: 500 }; // Corals & Reds
    case 'operator':
      return { color: '#4db8ff' }; // Ocean Blues
    case 'punctuation':
      return { color: '#1c88cb' }; // Ocean Blues Base
    case 'comment':
      return { color: '#7a7f9d', fontStyle: 'italic' }; // Ambient Muted
    case 'plain':
    default:
      return { color: '#f5f3f0' }; // Neutral Light
  }
}

interface PythonCodeHighlightProps {
  code: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
  editable?: boolean;
  onChange?: (newCode: string) => void;
  onReset?: () => void;
  isModified?: boolean;
}

export default function PythonCodeHighlight({
  code,
  filename = 'rule_based_optimizer.py',
  showLineNumbers = true,
  className = '',
  editable = false,
  onChange,
  onReset,
  isModified = false,
}: PythonCodeHighlightProps) {
  const [copied, setCopied] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Dynamic Theme Detection (Light vs Dark mode via document.documentElement.classList)
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  // Synchronize scrolling between overlay textarea, underlay syntax pre, and line numbers gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
  };

  // Handle Tab key indentation in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;

      // Insert 4 spaces
      const updated = val.substring(0, start) + '    ' + val.substring(end);
      if (onChange) {
        onChange(updated);
      }

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4;
          textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  const lines = code.split('\n');
  const lineCount = Math.max(lines.length, 1);

  return (
    <div
      className={`rounded-2xl border transition-all overflow-hidden font-mono text-xs ${
        isLight
          ? 'bg-slate-50 border-slate-200 shadow-xl'
          : 'border-white/10 shadow-2xl'
      } ${
        isFocused
          ? isLight
            ? 'border-blue-500/60 ring-2 ring-blue-500/20'
            : 'border-vibe-cyan/50 ring-1 ring-vibe-cyan/30'
          : ''
      } ${className}`}
      style={{ backgroundColor: isLight ? '#f8fafc' : '#0f0f18' }}
    >
      {/* Code Header Bar */}
      <div
        className={`px-4 py-2.5 border-b flex items-center justify-between text-xs transition-colors ${
          isLight
            ? 'bg-slate-100 border-slate-200 text-slate-900'
            : 'border-white/10 text-zinc-200'
        }`}
        style={{ backgroundColor: isLight ? '#f1f5f9' : '#1e1e2d' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Code2 size={15} style={{ color: isLight ? '#0284c7' : '#30dfee' }} />
          <span className={`font-semibold tracking-wide ${isLight ? 'text-slate-900' : 'text-zinc-200'}`}>
            {filename}
          </span>
          {isModified && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${
                isLight
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              Modified
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Reset to Recommended / Default Implementation */}
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className={`p-1.5 px-2.5 rounded-lg transition-all flex items-center gap-1.5 text-[11px] cursor-pointer ${
                isModified
                  ? isLight
                    ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300 font-semibold'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 font-semibold'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
              }`}
              title="Reset code to recommended default"
            >
              <RotateCcw size={12} className={isModified ? 'animate-spin-slow' : ''} />
              <span>Reset to Default</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`p-1.5 px-2 rounded-lg transition-colors flex items-center gap-1 text-[11px] cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
            }`}
            title="Copy code"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-500" />
                <span className="text-emerald-600 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor Body (Overlaid Live Syntax Highlighter + Textarea) */}
      <div className="flex items-stretch min-h-[280px] text-xs relative">
        {/* Gutter Line Numbers */}
        {showLineNumbers && (
          <div
            ref={gutterRef}
            className={`select-none py-4 pr-3 pl-4 text-right font-mono text-[11px] border-r shrink-0 overflow-hidden ${
              isLight
                ? 'border-slate-200 text-indigo-600 font-semibold bg-slate-100/60'
                : 'border-white/5 text-purple-400/70 bg-[#0c0c14]'
            }`}
          >
            {Array.from({ length: lineCount }).map((_, idx) => (
              <div key={idx} className="leading-[1.625rem]">
                {idx + 1}
              </div>
            ))}
          </div>
        )}

        {/* Code Content Viewport */}
        <div className="relative flex-1 overflow-hidden min-h-[280px]">
          {/* Layer 1 (Underlay): Syntax Highlighted Code */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="m-0 p-4 font-mono text-xs leading-[1.625rem] pointer-events-none select-none whitespace-pre overflow-hidden w-full h-full block absolute inset-0 font-medium"
            style={{ tabSize: 4 }}
          >
            <code>
              {lines.map((lineStr, lineIdx) => {
                const tokens = tokenizePythonLine(lineStr);
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

          {/* Layer 2 (Overlay): Transparent Interactive Textarea */}
          {editable ? (
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => onChange && onChange(e.target.value)}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              spellCheck={false}
              className="absolute inset-0 m-0 p-4 font-mono text-xs leading-[1.625rem] bg-transparent outline-none resize-none overflow-auto whitespace-pre font-medium w-full h-full z-10"
              style={{
                color: 'transparent',
                caretColor: isLight ? '#2563eb' : '#30dfee',
                tabSize: 4,
              }}
              placeholder="# Enter your custom Python optimization or agent prompt here..."
            />
          ) : (
            <div className="absolute inset-0" />
          )}
        </div>
      </div>

      {/* Editor Footer Help Bar */}
      {editable && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between text-[11px] font-mono transition-colors ${
            isLight
              ? 'bg-slate-100/90 border-slate-200 text-slate-600'
              : 'bg-black/50 border-white/5 text-zinc-400'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                isLight ? 'bg-blue-600' : 'bg-vibe-cyan'
              }`}
            />
            Live syntax-highlighted Python editor · Tab indent supported
          </span>
          <span className="font-semibold">{lineCount} lines</span>
        </div>
      )}
    </div>
  );
}


