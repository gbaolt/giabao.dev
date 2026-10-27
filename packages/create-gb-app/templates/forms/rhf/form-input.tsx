'use client';
import type { ComponentProps } from 'react';
import { Input } from '__UI_PREFIX__input';
import { FormBase, type FormControlFn } from './form-base';

export const FormInput: FormControlFn<
  Omit<
    ComponentProps<typeof Input>,
    | 'name'
    | 'id'
    | 'value'
    | 'defaultValue'
    | 'onChange'
    | 'onValueChange'
    | 'onBlur'
    | 'ref'
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
    {(field) => <Input {...props} {...field} value={field.value ?? ''} />}
  </FormBase>
);
