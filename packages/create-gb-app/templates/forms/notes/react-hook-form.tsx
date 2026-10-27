'use client';

import { useState } from 'react';
import { noteInputSchema, type NoteInput } from '__NOTE_VALIDATION__';
import { Button } from '__UI_PREFIX__button';
import { FieldGroup } from '__UI_PREFIX__field';
type NotesFormProps = {
  onSubmit: (input: NoteInput) => Promise<void>;
  persistent?: boolean;
  defaultValues?: NoteInput;
  submitLabel?: string;
};

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { FormInput } from './form/form-input';
import { FormTextarea } from './form/form-textarea';

export function NotesForm({
  onSubmit,
  persistent = true,
  defaultValues = { title: '', body: '' },
  submitLabel = persistent ? 'Add note' : 'Validate note',
}: NotesFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<
    z.input<typeof noteInputSchema>,
    unknown,
    z.output<typeof noteInputSchema>
  >({
    resolver: zodResolver(noteInputSchema),
    defaultValues,
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (input) => {
        setError(null);
        setMessage(null);
        try {
          await onSubmit(input);
          form.reset();
          setMessage(
            persistent
              ? 'Note saved.'
              : 'Note validated. No database is configured.'
          );
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'Could not save note'
          );
        }
      })}
    >
      <FieldGroup>
        <FormInput
          control={form.control}
          name="title"
          label="Title"
          description="A title is required."
          disabled={form.formState.isSubmitting}
        />
        <FormTextarea
          control={form.control}
          name="body"
          label="Body"
          disabled={form.formState.isSubmitting}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Submitting…' : submitLabel}
        </Button>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-muted-foreground text-sm">
            {message}
          </p>
        ) : null}
      </FieldGroup>
    </form>
  );
}
