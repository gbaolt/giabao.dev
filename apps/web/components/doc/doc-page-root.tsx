'use client';

import React from 'react';

export function DocPageRoot({
  children,
  ...props
}: React.ComponentPropsWithoutRef<'div'> & { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const docOgImage = container.querySelector<HTMLElement>(
      '[data-slot="doc-og-image"]'
    );

    const update = () => {
      if (!docOgImage) {
        document.documentElement.style.removeProperty('--doc-cols-top');
        container.removeAttribute('data-doc-cols-ready');
        return;
      }
      const top = docOgImage.getBoundingClientRect().top + window.scrollY;
      document.documentElement.style.setProperty('--doc-cols-top', `${top}px`);
      container.setAttribute('data-doc-cols-ready', '');
    };

    update();

    return () => {
      document.documentElement.style.removeProperty('--doc-cols-top');
      container.removeAttribute('data-doc-cols-ready');
    };
  }, []);

  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  );
}
