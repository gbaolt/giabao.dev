'use client';

import { useState } from 'react';
import { noteInputSchema, type NoteInput } from '@/lib/note-validation';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
type NotesFormProps = {
  onSubmit: (input: NoteInput) => Promise<void>;
  persistent?: boolean;
  defaultValues?: NoteInput;
  submitLabel?: string;
};

import { useAppForm } from './form/hooks';

export function NotesForm({
  onSubmit,
  persistent = true,
  defaultValues = { title: '', body: '' },
  submitLabel = persistent ? 'Add note' : 'Validate note',
}: NotesFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: noteInputSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      setMessage(null);
      try {
        await onSubmit(noteInputSchema.parse(value));
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
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.AppForm>
        <FieldGroup>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <>
                <form.AppField name="title">
                  {(field) => (
                    <field.Input
                      label="Title"
                      description="A title is required."
                      disabled={pending}
                    />
                  )}
                </form.AppField>
                <form.AppField name="body">
                  {(field) => (
                    <field.Textarea label="Body" disabled={pending} />
                  )}
                </form.AppField>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Submitting…' : submitLabel}
                </Button>
              </>
            )}
          </form.Subscribe>
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
      </form.AppForm>
    </form>
  );
}
