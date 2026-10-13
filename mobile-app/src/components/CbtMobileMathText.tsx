import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, StyleProp } from 'react-native';

interface CbtMobileMathTextProps {
  text?: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  inline?: boolean;
}

// Map common superscripts and subscripts
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'i': 'ᵢ', 'j': 'ⱼ'
};

// Convert basic LaTeX into clean readable Unicode math
export const formatLatexToUnicode = (latex: string): string => {
  if (!latex) return '';

  let res = latex.trim();

  // Normalize delimiters if included
  if (res.startsWith('$$') && res.endsWith('$$')) {
    res = res.slice(2, -2).trim();
  } else if (res.startsWith('$') && res.endsWith('$')) {
    res = res.slice(1, -1).trim();
  }

  // Fractions \frac{a}{b} -> (a / b) or a/b
  res = res.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');
  res = res.replace(/\\dfrac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');

  // Square roots \sqrt[n]{x} or \sqrt{x}
  res = res.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, 'ⁿ√($2)');
  res = res.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // Superscripts x^{2} or x^2
  res = res.replace(/\^{([^{}]+)}/g, (_, exp) => {
    return exp.split('').map((c: string) => SUPERSCRIPTS[c] || c).join('');
  });
  res = res.replace(/\^([0-9a-zA-Z+-])/g, (_, c) => SUPERSCRIPTS[c] || `^${c}`);

  // Subscripts x_{1} or x_1
  res = res.replace(/_{([^{}]+)}/g, (_, sub) => {
    return sub.split('').map((c: string) => SUBSCRIPTS[c] || c).join('');
  });
  res = res.replace(/_([0-9a-zA-Z+-])/g, (_, c) => SUBSCRIPTS[c] || `_${c}`);

  // Common math symbols & operators
  const symbols: [RegExp, string][] = [
    [/\\times/g, '×'],
    [/\\div/g, '÷'],
    [/\\pm/g, '±'],
    [/\\mp/g, '∓'],
    [/\\cdot/g, '·'],
    [/\\le/g, '≤'],
    [/\\leq/g, '≤'],
    [/\\ge/g, '≥'],
    [/\\geq/g, '≥'],
    [/\\ne/g, '≠'],
    [/\\neq/g, '≠'],
    [/\\approx/g, '≈'],
    [/\\equiv/g, '≡'],
    [/\\sim/g, '∼'],
    [/\\in/g, '∈'],
    [/\\notin/g, '∉'],
    [/\\subset/g, '⊂'],
    [/\\subseteq/g, '⊆'],
    [/\\cup/g, '∪'],
    [/\\cap/g, '∩'],
    [/\\emptyset/g, '∅'],
    [/\\infty/g, '∞'],
    [/\\pi/g, 'π'],
    [/\\theta/g, 'θ'],
    [/\\alpha/g, 'α'],
    [/\\beta/g, 'β'],
    [/\\gamma/g, 'γ'],
    [/\\Delta/g, 'Δ'],
    [/\\delta/g, 'δ'],
    [/\\lambda/g, 'λ'],
    [/\\mu/g, 'μ'],
    [/\\sigma/g, 'σ'],
    [/\\omega/g, 'ω'],
    [/\\angle/g, '∠'],
    [/\\triangle/g, '△'],
    [/\\circ/g, '°'],
    [/\\degree/g, '°'],
    [/\\perp/g, '⊥'],
    [/\\parallel/g, '∥'],
    [/\\to/g, '→'],
    [/\\rightarrow/g, '→'],
    [/\\Rightarrow/g, '⇒'],
    [/\\leftarrow/g, '←'],
    [/\\Leftarrow/g, '⇐'],
    [/\\iff/g, '⇔'],
    [/\\therefore/g, '∴'],
    [/\\because/g, '∵'],
    [/\\quad/g, '  '],
    [/\\qquad/g, '    '],
    [/\\,/g, ' '],
    [/\\text\{([^{}]+)\}/g, '$1'],
    [/\\mathrm\{([^{}]+)\}/g, '$1'],
    [/\\mathbf\{([^{}]+)\}/g, '$1'],
    [/\\left\(/g, '('],
    [/\\right\)/g, ')'],
    [/\\left\[/g, '['],
    [/\\right\]/g, ']'],
    [/\\left\\{/g, '{'],
    [/\\right\\}/g, '}'],
  ];

  for (const [regex, rep] of symbols) {
    res = res.replace(regex, rep);
  }

  // Remove any remaining stray backslashes before plain letters
  res = res.replace(/\\([a-zA-Z]+)/g, '$1');

  return res;
};

export const CbtMobileMathText: React.FC<CbtMobileMathTextProps> = ({
  text = '',
  style,
  containerStyle,
  inline = false,
}) => {
  if (!text) return null;

  // Split by $$ ... $$ or $ ... $
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  const parts = text.split(regex);

  if (parts.length === 1 && !text.includes('$')) {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <View style={[inline ? styles.inlineContainer : styles.blockContainer, containerStyle]}>
      <Text style={[styles.baseText, style]}>
        {parts.map((part, index) => {
          if (!part) return null;

          if (part.startsWith('$$') && part.endsWith('$$')) {
            const math = formatLatexToUnicode(part);
            return (
              <Text key={index} style={styles.blockMathText}>
                {'\n  '}{math}{'  \n'}
              </Text>
            );
          } else if (part.startsWith('$') && part.endsWith('$')) {
            const math = formatLatexToUnicode(part);
            return (
              <Text key={index} style={styles.inlineMathText}>
                {' '}{math}{' '}
              </Text>
            );
          }

          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    </View>
  );
};

export default CbtMobileMathText;

const styles = StyleSheet.create({
  inlineContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  blockContainer: {
    width: '100%',
  },
  baseText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 22,
  },
  inlineMathText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#eff6ff',
  },
  blockMathText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 15,
    color: '#1e3a8a',
    textAlign: 'center',
  },
});
