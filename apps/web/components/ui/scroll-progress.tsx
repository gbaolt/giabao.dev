'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValueEvent,
} from 'motion/react';
import * as React from 'react';

import { Popover, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import {
  EASE_OUT,
  LABEL_VERTICAL_PADDING,
  useScrollProgress,
} from '@/hooks/scroll-progress/use-scroll-progress';
import {
  useActiveLinkScroll,
  useTocScroll,
} from '@/hooks/scroll-progress/use-toc-scroll';
import {
  SURFACE_SHADOW_PADDING,
  SURFACE_TILE_OVERLAP,
  SURFACE_TILE_POSITIONS,
} from '@/lib/scroll-progress-morph';
import { cn } from '@/lib/utils';
import type {
  ScrollProgressProps,
  ScrollProgressSection,
  SectionLabelMotion,
  SectionLabelNavigation,
} from '@/types/scroll-progress';

type ScrollProgressContextValue = ReturnType<typeof useScrollProgress>;
const ScrollProgressContext =
  React.createContext<ScrollProgressContextValue | null>(null);
type ScrollProgressSectionsContextValue = {
  sections: ScrollProgressSection[];
  activeSectionId: string | undefined;
  visibleHeadingIds: Set<string>;
  minimumDepth: number;
  selectSection: ScrollProgressContextValue['actions']['selectSection'];
  activeLinkRef: React.RefObject<HTMLAnchorElement | null>;
};
const ScrollProgressSectionsContext =
  React.createContext<ScrollProgressSectionsContextValue | null>(null);

function useScrollProgressContext() {
  const context = React.use(ScrollProgressContext);
  if (!context)
    throw new Error(
      'Scroll progress components must be inside ScrollProgress.'
    );
  return context;
}

export function ScrollProgress({
  className,
  style,
  sections,
  containerRef,
  offset = 256,
  ...props
}: ScrollProgressProps) {
  const controller = useScrollProgress({ sections, containerRef, offset });
  const sectionsContext = React.useMemo(
    () => ({
      sections,
      activeSectionId: controller.state.activeSection?.id,
      visibleHeadingIds: controller.state.visibleHeadingIds,
      minimumDepth: controller.state.minimumDepth,
      selectSection: controller.actions.selectSection,
      activeLinkRef: controller.meta.activeLinkRef,
    }),
    [
      sections,
      controller.state.activeSection?.id,
      controller.state.visibleHeadingIds,
      controller.state.minimumDepth,
      controller.actions.selectSection,
      controller.meta.activeLinkRef,
    ]
  );
  if (!controller.state.activeSection) return null;

  return (
    <ScrollProgressContext value={controller}>
      <ScrollProgressSectionsContext value={sectionsContext}>
        <div
          data-slot="scroll-progress"
          className={cn(
            'fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-1/2 z-100 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 font-sans transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
            className
          )}
          {...props}
          data-ready={controller.state.ready}
          aria-hidden={controller.state.ready ? props['aria-hidden'] : true}
          inert={!controller.state.ready || props.inert}
          style={{
            ...style,
            opacity: controller.state.ready ? style?.opacity : 0,
            visibility: controller.state.ready ? style?.visibility : 'hidden',
          }}
        >
          <div className="relative">
            <ScrollProgressBackground />
            <Popover
              open={controller.state.open}
              onOpenChange={controller.actions.onOpenChange}
            >
              <ScrollProgressTrigger />
              <ScrollProgressContent />
            </Popover>
          </div>
        </div>
      </ScrollProgressSectionsContext>
    </ScrollProgressContext>
  );
}

function ScrollProgressBackground() {
  const {
    state: { sizes },
    meta: { surfaceRef },
  } = useScrollProgressContext();
  // Only straight edges stretch; corners, border thickness and shadows stay unscaled.
  return (
    <div
      ref={surfaceRef}
      data-slot="scroll-progress-background"
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      {SURFACE_TILE_POSITIONS.map(([column, row]) => {
        const radius = sizes.trigger.height / 2;
        const offsets = [
          SURFACE_SHADOW_PADDING,
          -radius,
          -radius * 3 + SURFACE_TILE_OVERLAP,
        ];
        return (
          <div
            key={`${column}-${row}`}
            className="absolute origin-top-left overflow-hidden"
            style={{
              left: column === 0 ? 0 : column === 1 ? radius : '100%',
              top: row === 0 ? 0 : row === 1 ? radius : '100%',
              translate: `${column === 0 ? -SURFACE_SHADOW_PADDING : column === 1 ? 0 : -radius - SURFACE_TILE_OVERLAP}px ${row === 0 ? -SURFACE_SHADOW_PADDING : row === 1 ? 0 : -radius - SURFACE_TILE_OVERLAP}px`,
              width:
                column === 1
                  ? `calc(100% - ${radius * 2}px)`
                  : radius + SURFACE_SHADOW_PADDING + SURFACE_TILE_OVERLAP,
              height:
                row === 1
                  ? `calc(100% - ${radius * 2}px)`
                  : radius + SURFACE_SHADOW_PADDING + SURFACE_TILE_OVERLAP,
            }}
          >
            <div
              className="bg-surface ring-foreground/10 border-border/50 absolute border shadow-sm ring-1"
              style={{
                width:
                  column === 1 ? `calc(100% + ${radius * 2}px)` : radius * 4,
                height: row === 1 ? `calc(100% + ${radius * 2}px)` : radius * 4,
                borderRadius: radius,
                left: offsets[column],
                top: offsets[row],
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ScrollProgressTrigger() {
  const {
    state: {
      open,
      expanded,
      ready,
      keyboardInteraction,
      sizes,
      labelSection,
      labelNavigation,
      labelMotion,
      scrollYProgress,
    },
    actions: { setKeyboardInteraction, finishLabel },
    meta: { triggerRef, stripRef },
  } = useScrollProgressContext();
  if (!labelSection) return null;

  return (
    <PopoverTrigger
      ref={triggerRef}
      disabled={!ready}
      style={expanded ? { width: sizes.popup.width } : undefined}
      aria-label={open ? 'Hide table of contents' : 'Show table of contents'}
      onKeyDown={() => setKeyboardInteraction(true)}
      onPointerDown={() => setKeyboardInteraction(false)}
      className={cn(
        'text-surface-foreground relative flex h-12 items-center gap-4 rounded-full pr-3 pl-4 text-left text-base font-medium outline-none',
        !expanded && 'max-w-64 min-w-44',
        keyboardInteraction && 'transition-none active:scale-100'
      )}
    >
      <span
        data-slot="scroll-progress-dot"
        aria-hidden
        className="bg-foreground size-2 shrink-0 rounded-full"
      />
      <span
        data-slot="scroll-progress-label-viewport"
        className="flex min-w-0 flex-1 self-stretch overflow-hidden"
        style={{ marginBlock: LABEL_VERTICAL_PADDING }}
      >
        <span
          data-slot="scroll-progress-label-mask"
          className="flex min-w-0 flex-1 overflow-hidden"
        >
          <span
            data-slot="scroll-progress-label-content"
            className="flex min-w-0 flex-1"
          >
            {labelNavigation && labelMotion.mode === 'slide' ? (
              <NavigationSectionLabel
                navigation={labelNavigation}
                rowHeight={labelMotion.edgeOffset * 2}
                stripRef={stripRef}
                onComplete={finishLabel}
              />
            ) : (
              <SectionLabel section={labelSection} motion={labelMotion} />
            )}
          </span>
        </span>
      </span>
      <span data-slot="scroll-progress-ring" className="shrink-0">
        <ProgressRing progress={scrollYProgress} />
      </span>
    </PopoverTrigger>
  );
}

function ScrollProgressContent() {
  const {
    state: { open, keyboardInteraction, contentReady },
    meta: { setPopupElement, activeLinkRef },
  } = useScrollProgressContext();
  return (
    <PopoverPrimitive.Portal keepMounted>
      <PopoverPrimitive.Positioner
        // Keep the closed menu measurable so preparation finishes before the pill appears.
        hidden={false}
        inert={!open}
        aria-hidden={!open}
        side="top"
        sideOffset={0}
        positionMethod="fixed"
        collisionAvoidance={{ side: 'none', align: 'shift' }}
        className="isolate z-110"
      >
        <PopoverPrimitive.Popup
          ref={setPopupElement}
          initialFocus={(interaction) =>
            interaction === 'keyboard' ? activeLinkRef.current : false
          }
          data-slot="scroll-progress-surface"
          data-ready={contentReady}
          className={cn(
            'text-surface-foreground relative flex w-[min(360px,calc(100vw-2rem))] origin-(--transform-origin) flex-col overflow-hidden rounded-t-3xl border-b transition-[opacity,translate] duration-100 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-ending-style:pointer-events-none data-ending-style:translate-y-1 data-ending-style:opacity-0 data-starting-style:translate-y-1 data-starting-style:opacity-0 data-[ready=false]:pointer-events-none data-[ready=false]:translate-y-1 data-[ready=false]:opacity-0 motion-reduce:translate-none! motion-reduce:duration-120',
            keyboardInteraction && 'translate-none! transition-none!'
          )}
        >
          <PopoverTitle className="text-muted-foreground border-b px-5 pt-4 pb-2 text-xs font-semibold uppercase">
            Table of contents
          </PopoverTitle>
          <ScrollProgressSectionList />
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function ScrollProgressSectionList() {
  const {
    state: { open },
    meta: { popupElement, activeLinkRef },
  } = useScrollProgressContext();
  const listRef = React.useRef<HTMLElement>(null);
  const scroll = useTocScroll(listRef, popupElement, open);
  useActiveLinkScroll(listRef, activeLinkRef, popupElement, open);
  return (
    <div className="relative" onWheel={scroll.stop}>
      <nav
        ref={listRef}
        aria-label="Table of contents"
        className="no-scrollbar scroll-fade max-h-[min(360px,calc(100dvh-14rem))] overflow-y-auto overscroll-contain p-2 sm:max-h-[min(360px,calc(100dvh-10rem))]"
      >
        <TOCScrollChevron direction="up" scroll={scroll} />
        <ScrollProgressSections />
        <TOCScrollChevron direction="down" scroll={scroll} />
      </nav>
    </div>
  );
}

function ScrollProgressSections() {
  const context = React.use(ScrollProgressSectionsContext);
  if (!context) throw new Error('Sections must be inside ScrollProgress.');
  const {
    sections,
    activeSectionId,
    visibleHeadingIds,
    minimumDepth,
    selectSection,
    activeLinkRef,
  } = context;
  return (
    <ul className="flex flex-col gap-1">
      {sections.map((section) => (
        <li key={section.id}>
          <ScrollProgressSectionLink
            section={section}
            active={section.id === activeSectionId}
            visible={visibleHeadingIds.has(section.id)}
            minimumDepth={minimumDepth}
            selectSection={selectSection}
            activeLinkRef={activeLinkRef}
          />
        </li>
      ))}
    </ul>
  );
}

function ScrollProgressSectionLink({
  section,
  active,
  visible,
  minimumDepth,
  selectSection,
  activeLinkRef,
}: {
  section: ScrollProgressSection;
  active: boolean;
  visible: boolean;
  minimumDepth: number;
  selectSection: ScrollProgressContextValue['actions']['selectSection'];
  activeLinkRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  return (
    <a
      ref={active ? activeLinkRef : undefined}
      href={'#' + encodeURIComponent(section.id)}
      aria-current={active ? 'location' : undefined}
      data-active={active}
      data-visible={visible}
      className={cn(
        'text-muted-foreground hover:bg-foreground/5 hover:text-foreground focus-visible:ring-ring flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset',
        (active || visible) && 'text-foreground',
        active && 'bg-foreground/10'
      )}
      onClick={(event) => selectSection(event, section.id)}
    >
      <span
        className="min-w-0 flex-1"
        style={{
          paddingLeft: Math.max(0, (section.depth ?? 2) - minimumDepth) * 16,
        }}
      >
        {section.label}
      </span>
      {active ? (
        <span
          aria-hidden
          className="bg-foreground size-1.5 shrink-0 rounded-full"
        />
      ) : null}
    </a>
  );
}

function TOCScrollChevron({
  direction,
  scroll,
}: {
  direction: 'up' | 'down';
  scroll: ReturnType<typeof useTocScroll>;
}) {
  const amount = direction === 'up' ? -1 : 1;
  const Icon = direction === 'up' ? ChevronUpIcon : ChevronDownIcon;
  const canScroll = direction === 'up' ? scroll.up : scroll.down;

  return (
    <button
      type="button"
      aria-label={`Scroll table of contents ${direction}`}
      aria-hidden={!canScroll}
      disabled={!canScroll}
      tabIndex={canScroll ? 0 : -1}
      data-slot={`toc-scroll-${direction}`}
      className={cn(
        'text-muted-foreground from-surface hover:text-foreground absolute inset-x-0 z-1 flex h-8 justify-center from-20% to-transparent to-100% transition-opacity duration-120 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none',
        canScroll ? 'opacity-100' : 'pointer-events-none opacity-0',
        direction === 'up'
          ? 'top-0 items-start bg-linear-to-b pt-1'
          : 'bottom-0 items-end bg-linear-to-t pb-1'
      )}
      onPointerEnter={(event) => {
        if (
          canScroll &&
          event.pointerType === 'mouse' &&
          window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ) {
          scroll.start(amount);
        }
      }}
      onPointerLeave={scroll.stop}
      onPointerCancel={scroll.stop}
      onClick={() => scroll.scrollPage(amount)}
    >
      <Icon aria-hidden className="size-4 transition-colors" />
    </button>
  );
}

function labelTransform(
  { mode, edgeOffset }: SectionLabelMotion,
  direction: number
) {
  return mode === 'slide'
    ? 'translateY(calc(' +
        direction * 50 +
        '% + ' +
        direction * edgeOffset +
        'px))'
    : 'translateY(0px)';
}

function SectionLabel({
  section,
  motion: labelMotion,
}: {
  section: ScrollProgressSection;
  motion: SectionLabelMotion;
}) {
  return (
    <span className="relative flex min-w-0 flex-1 items-center text-sm">
      <span aria-hidden className="invisible block truncate">
        {section.label}
      </span>
      <AnimatePresence initial={false} custom={labelMotion}>
        <motion.span
          key={section.id}
          data-slot="scroll-progress-label"
          className="absolute inset-x-0 top-1/2 block -translate-y-1/2 truncate select-none!"
          custom={labelMotion}
          initial={labelMotion.mode === 'instant' ? false : 'enter'}
          animate="visible"
          exit="exit"
          variants={{
            enter: (config: SectionLabelMotion) => ({
              transform: labelTransform(config, config.direction),
              opacity: 0,
            }),
            visible: { transform: 'translateY(0px)', opacity: 1 },
            exit: (config: SectionLabelMotion) => ({
              transform: labelTransform(config, -config.direction),
              opacity: 0,
              transition: { duration: config.duration, ease: EASE_OUT },
            }),
          }}
          transition={{ duration: labelMotion.duration, ease: EASE_OUT }}
        >
          {section.label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function NavigationSectionLabel({
  navigation,
  rowHeight,
  stripRef,
  onComplete,
}: {
  navigation: SectionLabelNavigation;
  rowHeight: number;
  stripRef: React.RefObject<HTMLSpanElement | null>;
  onComplete: (navigation: SectionLabelNavigation) => void;
}) {
  const height = Math.max(1, rowHeight);
  const rows =
    navigation.direction > 0
      ? navigation.sections
      : navigation.sections.toReversed();
  const target = navigation.sections.at(-1)!;

  React.useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const distance = (navigation.sections.length - 1) * height;
    const from = navigation.direction > 0 ? 0 : -distance;
    const to = navigation.direction > 0 ? -distance : 0;
    strip.style.transform = `translateY(${to}px)`;

    const animation = strip.animate(
      [
        { transform: `translateY(${from}px)` },
        { transform: `translateY(${to}px)` },
      ],
      { duration: 500, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' }
    );
    void animation.finished.then(
      () => {
        animation.cancel();
        onComplete(navigation);
      },
      () => {}
    );
    return () => {
      animation.cancel();
    };
  }, [navigation, height, stripRef, onComplete]);

  return (
    <span className="relative flex min-w-0 flex-1 items-center text-sm">
      <span aria-hidden className="invisible block truncate">
        {target.label}
      </span>
      <span className="sr-only">{target.label}</span>
      <span
        ref={stripRef}
        aria-hidden
        data-slot="scroll-progress-label-strip"
        className="absolute inset-x-0 top-1/2"
        style={{ marginTop: -height / 2 }}
      >
        {rows.map((section) => (
          <span
            key={section.id}
            className="flex items-center"
            style={{ height }}
          >
            <span className="block min-w-0 truncate select-none!">
              {section.label}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function ProgressRing({ progress }: { progress: MotionValue<number> }) {
  const [percentage, setPercentage] = React.useState(() =>
    Math.round(progress.get() * 100)
  );
  useMotionValueEvent(progress, 'change', (value) => {
    setPercentage(Math.round(value * 100));
  });

  return (
    <svg
      viewBox="0 0 32 32"
      className="size-6 shrink-0 -rotate-90"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        strokeWidth="3"
        className="stroke-foreground/30"
      />
      <motion.circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-foreground"
        style={{ pathLength: progress }}
      />
    </svg>
  );
}

export default ScrollProgress;
