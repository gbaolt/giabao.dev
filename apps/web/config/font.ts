import localFont from 'next/font/local';

import { cn } from '@/lib/utils';

const fontSans = localFont({
  src: '../assets/fonts/Geist-Variable.woff2',
  weight: '100 900',
  variable: '--font-geist-sans',
});

const fontMono = localFont({
  src: '../assets/fonts/GeistMono-Variable.woff2',
  weight: '100 900',
  variable: '--font-geist-mono',
  adjustFontFallback: false,
  fallback: [
    'ui-monospace',
    'SFMono-Regular',
    'Roboto Mono',
    'Menlo',
    'Monaco',
    'Liberation Mono',
    'DejaVu Sans Mono',
    'Courier New',
    'monospace',
  ],
});

export const fontPixel = localFont({
  src: '../assets/fonts/DepartureMono-Regular.woff2',
  weight: '400',
  fallback: ['monospace'],
  variable: '--font-pixel',
});

// geist/font/pixel evaluates every pixel variant; Square is the only used face.
const fontPixelSquare = localFont({
  src: '../node_modules/geist/dist/fonts/geist-pixel/GeistPixel-Square.woff2',
  weight: '500',
  variable: '--font-geist-pixel-square',
  fallback: [
    'Geist Mono',
    'ui-monospace',
    'SFMono-Regular',
    'Roboto Mono',
    'Menlo',
    'Monaco',
    'Liberation Mono',
    'DejaVu Sans Mono',
    'Courier New',
    'monospace',
  ],
  adjustFontFallback: false,
});

export const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontPixel.variable,
  fontPixelSquare.variable,
  '[--font-sans:var(--font-geist-sans)]',
  '[--font-mono:var(--font-geist-mono)]'
);
