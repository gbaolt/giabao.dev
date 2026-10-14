import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import {
  Children,
  type ComponentProps,
  type CSSProperties,
  Fragment,
  isValidElement,
  type ReactNode,
} from 'react';

import { PdfList } from '@/components/pdf/list/list';
import { usePdfcnTheme } from '@/components/pdf/theme-provider';
import { flatten, Text, View } from '@/lib/pdfcn/pdf-primitives';

import { useBodyTextStyle } from '../../hooks/use-body-text-style';
import { ExternalLinkPdfIcon } from './icons';

type WithChildren = { children?: ReactNode };

export function SectionHeading({ children }: WithChildren) {
  const theme = usePdfcnTheme();
  const { heading } = theme.typography;

  return (
    <h2
      style={
        flatten({
          fontFamily: heading.fontFamily,
          fontSize: heading.fontSize.h2,
          fontWeight: heading.fontWeight,
          lineHeight: heading.lineHeight,
          color: theme.colors.foreground,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          margin: 0,
          marginTop: theme.spacing.sectionGap,
          marginBottom: theme.spacing.componentGap,
          borderBottomWidth: 2.5,
          borderBottomStyle: 'solid',
          borderBottomColor: theme.colors.divider,
        }) as CSSProperties
      }
    >
      {children}
    </h2>
  );
}

type ResumeHeadingProps = {
  'data-resume-title'?: string;
  'data-resume-subtitle'?: string;
  'data-resume-date'?: string;
  'data-resume-href'?: string;
  'data-resume-location'?: string;
};

export function ResumeHeading({
  'data-resume-title': title,
  'data-resume-subtitle': subtitle,
  'data-resume-date': date,
  'data-resume-href': href,
  'data-resume-location': location,
}: ResumeHeadingProps) {
  const theme = usePdfcnTheme();
  const { body, heading } = theme.typography;
  const metaStyle = { fontSize: body.fontSize, color: theme.colors.foreground };

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text
            href={href}
            style={{
              fontFamily: heading.fontFamily,
              fontSize: heading.fontSize.h3,
              fontWeight: heading.fontWeight,
              color: theme.colors.foreground,
              textDecoration: 'none',
            }}
          >
            {title}
          </Text>
          {href ? <ExternalLinkPdfIcon size={7} /> : null}
        </View>
        {date ? (
          <Text style={{ ...metaStyle, color: theme.colors.mutedForeground }}>
            {date}
          </Text>
        ) : null}
      </View>

      {subtitle || location ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <Text style={{ ...metaStyle, fontStyle: 'italic' }}>
            {subtitle ?? ''}
          </Text>
          {location ? (
            <Text style={{ ...metaStyle, color: theme.colors.mutedForeground }}>
              {location}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function Paragraph({ children }: WithChildren) {
  const bodyStyle = useBodyTextStyle();

  return <Text style={bodyStyle}>{children}</Text>;
}

export function ResumeList({ children }: WithChildren) {
  const items = Children.toArray(children)
    .filter(isValidElement<{ children?: ReactNode }>)
    .map((item) => ({ text: item.props.children }));

  return <PdfList items={items} gap="xs" />;
}

export function ListItem({ children }: WithChildren) {
  const bodyStyle = useBodyTextStyle();

  return (
    <View>
      <Text style={bodyStyle}>{children}</Text>
    </View>
  );
}

function Anchor({ href, children }: ComponentProps<'a'>) {
  const theme = usePdfcnTheme();

  return (
    <Text
      href={href}
      style={{ color: theme.colors.foreground, textDecoration: 'none' }}
    >
      {children}
    </Text>
  );
}

function Strong({ children }: WithChildren) {
  return <Text style={{ fontWeight: 700 }}>{children}</Text>;
}

function Emphasis({ children }: WithChildren) {
  return <Text style={{ fontStyle: 'italic' }}>{children}</Text>;
}

export const resumePdfComponents: MDXRemoteProps['components'] = {
  h2: SectionHeading,
  h3: ResumeHeading,
  p: Paragraph,
  ul: ResumeList,
  li: ListItem,
  a: Anchor,
  strong: Strong,
  em: Emphasis,
};
