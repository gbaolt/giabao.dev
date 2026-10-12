'use client';

import { Button } from '@/components/ui/button';
import { RESUME_PDF_FILENAME, RESUME_PDF_PATH } from '@/config/resume';

export function ResumeViewerError({
  onRetry,
  compact = false,
}: {
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center"
      role="alert"
    >
      <p className="text-muted-foreground text-sm">
        {compact
          ? 'This PDF page could not be rendered.'
          : 'The Resume PDF could not be loaded.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={RESUME_PDF_PATH} download={RESUME_PDF_FILENAME} />}
        >
          Download PDF
        </Button>
      </div>
    </div>
  );
}
