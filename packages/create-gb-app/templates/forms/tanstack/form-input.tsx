'use client';
import type { ComponentProps } from 'react';
import { Input } from '__UI_PREFIX__input';
import { useFieldContext } from './contexts';
import { FormBase, type FormControlProps } from './form-base';

export function FormInput({
  label,
  description,
  disabled,
  fieldClassName,
  ...props
}: FormControlProps &
  Omit<
    ComponentProps<typeof Input>,
    | 'name'
    | 'id'
    | 'value'
    | 'defaultValue'
    | 'onChange'
    | 'onValueChange'
    | 'onBlur'
  >) {
  const field = useFieldContext<string>();
  return (
    <FormBase {...{ label, description, disabled, fieldClassName }}>
      {(accessibility) => (
        <Input
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
