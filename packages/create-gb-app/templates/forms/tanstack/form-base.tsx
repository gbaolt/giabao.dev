'use client';
import { useId, type ReactNode } from 'react';
import { useFieldContext } from './contexts';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';

export type FormControlProps = {
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  fieldClassName?: string;
};
type Accessibility = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

export function FormBase({
  children,
  label,
  description,
  disabled,
  fieldClassName,
}: FormControlProps & { children: (props: Accessibility) => ReactNode }) {
  const field = useFieldContext<unknown>();
  const id = useId();
  const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const messages = field.state.meta.errors.flatMap((error) => {
    if (typeof error === 'string') return [{ message: error }];
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    )
      return [{ message: error.message }];
    return [];
  });
  return (
    <Field
      data-invalid={invalid}
      data-disabled={disabled}
      className={fieldClassName}
    >
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      {children({
        id,
        'aria-invalid': invalid,
        'aria-describedby':
          [
            description ? id + '-description' : null,
            invalid ? id + '-error' : null,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      })}
      {description ? (
        <FieldDescription id={id + '-description'}>
          {description}
        </FieldDescription>
      ) : null}
      {invalid ? <FieldError id={id + '-error'} errors={messages} /> : null}
    </Field>
  );
}
