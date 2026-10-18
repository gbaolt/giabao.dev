import type { ComponentProps } from 'react';

import { Code, Heading } from '@/components/ui/typography';

import { FramedImage } from './embed';
import { mdxCodeBlockComponents } from './mdx-code-block';

export const mdxComponents = {
  h1: (props: ComponentProps<'h1'>) => <Heading as="h1" {...props} />,
  h2: (props: ComponentProps<'h2'>) => <Heading as="h2" {...props} />,
  h3: (props: ComponentProps<'h3'>) => <Heading as="h3" {...props} />,
  h4: (props: ComponentProps<'h4'>) => <Heading as="h4" {...props} />,
  h5: (props: ComponentProps<'h5'>) => <Heading as="h5" {...props} />,
  h6: (props: ComponentProps<'h6'>) => <Heading as="h6" {...props} />,
  ...mdxCodeBlockComponents,
  code: Code,
  FramedImage,
};
