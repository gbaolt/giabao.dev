'use client';

import { parseConfiguration } from 'create-gb-app/preset';
import { BookOpenIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { MDXDocument } from '@/components/mdx/mdx-document';
import { usePackageManager } from '@/components/ncdai/code-block-command';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

import { generatePreview } from '../lib/actions/generate-preview';
import { CreateCommand } from './create-command';
import { useCreate } from './create-provider';

export function CreateSetupGuide() {
  const { flags, projectName } = useCreate();
  const [selectedManager] = usePackageManager();
  const packageManager = selectedManager === 'prompt' ? 'bun' : selectedManager;
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flagsJson = JSON.stringify(flags);
  const requestKey = `${projectName}:${packageManager}:${flagsJson}`;
  const [guideKey, setGuideKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void generatePreview(
      parseConfiguration(JSON.parse(flagsJson)),
      projectName,
      packageManager
    )
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setGuide(result.files['README.md'] ?? 'No README was generated.');
          setError(null);
        } else {
          setGuide(null);
          setError(result.message);
        }
        setGuideKey(requestKey);
      })
      .catch(() => {
        if (cancelled) return;
        setGuide(null);
        setError('Could not generate the setup guide. Please try again.');
        setGuideKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [open, flagsJson, projectName, packageManager, requestKey]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <BookOpenIcon data-icon="inline-start" />
        Setup guide
      </DialogTrigger>
      <DialogContent className="flex h-[85svh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle>Setup guide</DialogTitle>
          <DialogDescription>
            Follow the README generated for your current configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {guideKey === requestKey && error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : guideKey === requestKey && guide ? (
            <MDXDocument content={guide} />
          ) : (
            <div className="text-muted-foreground flex items-center gap-2">
              <Spinner />
              Generating setup guide…
            </div>
          )}
        </div>
        <DialogFooter className="dark:bg-background/50 mx-0 mb-0 flex shrink-0 flex-col items-stretch gap-2 rounded-none border-t p-4 sm:flex-col sm:justify-start">
          <span className="text-muted-foreground text-xs font-medium">
            Create your project
          </span>
          <CreateCommand />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
