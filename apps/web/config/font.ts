import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import localFont from 'next/font/local';

import { cn } from '@/lib/utils';

const fontSans = GeistSans;
const fontMono = GeistMono;

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
