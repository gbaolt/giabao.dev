'use client';
import type { ComponentProps } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useFieldContext } from './contexts';
import { FormBase, type FormControlProps } from './form-base';

export function FormTextarea({
  label,
  description,
  disabled,
  fieldClassName,
  ...props
}: FormControlProps &
  Omit<
    ComponentProps<typeof Textarea>,
    'name' | 'id' | 'value' | 'defaultValue' | 'onChange' | 'onBlur'
  >) {
  const field = useFieldContext<string>();
  return (
    <FormBase {...{ label, description, disabled, fieldClassName }}>
      {(accessibility) => (
        <Textarea
          {...props}
          {...accessibility}
          name={field.name}
          value={field.state.value}
          disabled={disabled}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
        />
      )}
    </FormBase>
  );
}
