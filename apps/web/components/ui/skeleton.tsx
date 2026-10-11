import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-muted relative overflow-hidden rounded-sm',
        '[--skeleton-highlight:--alpha(var(--color-white)/64%)] dark:[--skeleton-highlight:--alpha(var(--color-white)/4%)]',
        'before:animate-skeleton before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[300%] before:[background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_0_0/calc(200%/3)_100%]',
        'motion-reduce:before:hidden',
        className
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
