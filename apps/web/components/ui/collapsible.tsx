'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import React from 'react';

import {
  ChevronsDownUpIcon,
  type ChevronsDownUpIconHandle,
  type ChevronsDownUpIconProps,
} from '@/components/icons/chevrons-down-up-icon';
import { cn } from '@/lib/utils';

type CollapsibleContextType = {
  open: boolean;
};

const CollapsibleContext = React.createContext<CollapsibleContextType | null>(
  null
);

function useCollapsible() {
  const context = React.useContext(CollapsibleContext);

  if (!context) {
    throw new Error(
      'Collapsible components must be used within a CollapsibleWithContext'
    );
  }

  return context;
}

function Collapsible({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  ...props
}: CollapsiblePrimitive.Root.Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  return (
    <CollapsibleContext value={{ open }}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        open={open}
        onOpenChange={(nextOpen, eventDetails) => {
          onOpenChange?.(nextOpen, eventDetails);
          if (controlledOpen === undefined && !eventDetails.isCanceled) {
            setUncontrolledOpen(nextOpen);
          }
        }}
        className={cn('group/collapsible', className)}
        {...props}
      />
    </CollapsibleContext>
  );
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  className,
  ...props
}: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      className={cn(
        'h-(--collapsible-panel-height) overflow-hidden data-ending-style:h-0 data-starting-style:h-0 sm:transition-[height] sm:duration-200 sm:ease-out [&[hidden]:not([hidden=until-found])]:hidden',
        className
      )}
      {...props}
    />
  );
}

function useCollapsibleAnimation<
  T extends { startAnimation: () => void; stopAnimation: () => void },
>(ref: React.RefObject<T | null>) {
  const { open } = useCollapsible();

  React.useEffect(() => {
    const controls = ref.current;
    if (!controls) return;

    if (open) {
      controls.startAnimation();
    } else {
      controls.stopAnimation();
    }
  }, [open, ref]);
}

function CollapsibleChevronsIcon(props: Omit<ChevronsDownUpIconProps, 'ref'>) {
  const ref = React.useRef<ChevronsDownUpIconHandle>(null);
  useCollapsibleAnimation(ref);
  return <ChevronsDownUpIcon ref={ref} {...props} />;
}

function CollapsibleChevronDownIcon({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <ChevronDownIcon
      className={cn(
        'transition-[rotate] ease-in-out group-data-open/collapsible:rotate-180',
        className
      )}
      {...props}
    />
  );
}

export {
  Collapsible,
  CollapsibleChevronDownIcon,
  CollapsibleChevronsIcon,
  CollapsibleContent,
  CollapsibleTrigger,
};
