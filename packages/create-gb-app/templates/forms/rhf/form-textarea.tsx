'use client';
import type { ComponentProps } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { FormBase, type FormControlFn } from './form-base';

export const FormTextarea: FormControlFn<
  Omit<
    ComponentProps<typeof Textarea>,
    'name' | 'id' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref'
  >
> = ({
  control,
  name,
  label,
  description,
  disabled,
  fieldClassName,
  ...props
}) => (
  <FormBase
    {...{ control, name, label, description, disabled, fieldClassName }}
  >
    {(field) => <Textarea {...props} {...field} value={field.value ?? ''} />}
  </FormBase>
);
