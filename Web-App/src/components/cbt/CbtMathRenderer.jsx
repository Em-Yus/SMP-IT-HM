import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Memecah string teks biasa dan ekspresi matematika ($...$ atau $$...$$)
 */
function parseMathText(content) {
  if (!content) return [];
  const text = String(content);

  // Jika teks tidak mengandung indikasi rumus matematika ($, \, ^, _, dll), langsung return sebagai teks biasa
  const hasMathHint = text.includes('$') || text.includes('\\') || /\^[0-9a-zA-Z{]/.test(text) || /_[0-9a-zA-Z{]/.test(text);
  if (!hasMathHint) {
    return [{ type: 'text', value: text }];
  }

  // Regex mendeteksi:
  // 1. $$ ... $$ (display mode)
  // 2. $ ... $ (inline mode)
  // 3. \[ ... \] (display mode)
  // 4. \( ... \) (inline mode)
  const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = mathRegex.exec(text)) !== null) {
    // Teks sebelum rumus
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
      });
    }

    const raw = match[0];
    let formula = '';
    let isBlock = false;

    if (raw.startsWith('$$') && raw.endsWith('$$')) {
      formula = raw.slice(2, -2).trim();
      isBlock = true;
    } else if (raw.startsWith('$') && raw.endsWith('$')) {
      formula = raw.slice(1, -1).trim();
      isBlock = false;
    } else if (raw.startsWith('\\[') && raw.endsWith('\\]')) {
      formula = raw.slice(2, -2).trim();
      isBlock = true;
    } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
      formula = raw.slice(2, -2).trim();
      isBlock = false;
    }

    segments.push({
      type: 'math',
      value: formula,
      isBlock,
    });

    lastIndex = match.index + raw.length;
  }

  // Sisa teks setelah rumus terakhir
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    // Cek jika seluruh string tidak memakai $ tapi mengandung command LaTeX murni (misal: \frac{a}{b} atau \sqrt{x})
    if (segments.length === 0 && (remaining.startsWith('\\') || remaining.includes('\\frac') || remaining.includes('\\sqrt'))) {
      segments.push({
        type: 'math',
        value: remaining.trim(),
        isBlock: false,
      });
    } else {
      segments.push({
        type: 'text',
        value: remaining,
      });
    }
  }

  // Kasus fallback jika regex tidak menangkap apa-apa tapi ada command LaTeX murni
  if (segments.length === 0) {
    if (text.startsWith('\\') || text.includes('\\frac') || text.includes('\\sqrt')) {
      segments.push({ type: 'math', value: text.trim(), isBlock: false });
    } else {
      segments.push({ type: 'text', value: text });
    }
  }

  return segments;
}

/**
 * Komponen Renderer Teks & Rumus Matematika (KaTeX)
 */
export default function CbtMathRenderer({ text, className = '', inline = false }) {
  const segments = useMemo(() => parseMathText(text), [text]);

  if (!text) return null;

  return (
    <span className={`inline-math-container ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'math') {
          try {
            const html = katex.renderToString(seg.value, {
              throwOnError: false,
              displayMode: !inline && seg.isBlock,
              strict: false,
            });
            return (
              <span
                key={idx}
                className={seg.isBlock && !inline ? 'block my-2 overflow-x-auto text-center' : 'inline-block px-0.5'}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch (err) {
            console.warn('KaTeX render error:', err);
            return (
              <span key={idx} className="text-red-500 font-mono text-xs">
                {seg.value}
              </span>
            );
          }
        }

        // Teks biasa: render dengan memperhatikan line breaks (\n)
        return (
          <span key={idx} className="whitespace-pre-wrap">
            {seg.value}
          </span>
        );
      })}
    </span>
  );
}
