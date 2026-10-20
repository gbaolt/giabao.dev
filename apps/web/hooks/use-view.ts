import { useInView, usePageInView } from 'motion/react';
import type { RefObject } from 'react';

export function useView(ref: RefObject<Element | null>) {
  const isPageInView = usePageInView();
  const isInView = useInView(ref);

  return { isPageInView, isInView };
}
