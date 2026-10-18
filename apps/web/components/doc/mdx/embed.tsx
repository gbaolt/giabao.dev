import { ImageZoom } from '@/components/kibo-ui/image-zoom';

export function FramedImage({
  canZoom = true,
  ...props
}: React.ComponentProps<'img'> & {
  canZoom?: boolean;
}) {
  const image = <img alt={props.alt} {...props} />;

  return (
    <figure className="relative [&_img]:rounded-lg">
      {canZoom ? <ImageZoom>{image}</ImageZoom> : image}

      <div className="pointer-events-none absolute inset-0 rounded-lg inset-ring-1 inset-ring-black/10 dark:inset-ring-white/10" />
    </figure>
  );
}
