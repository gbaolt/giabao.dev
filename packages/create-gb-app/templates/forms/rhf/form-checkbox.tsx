'use client';
import { Checkbox } from '__UI_PREFIX__checkbox';
import { FormBase, type FormControlFn } from './form-base';

export const FormCheckbox: FormControlFn = (props) => (
  <FormBase {...props}>
    {({ value, onChange, ...field }) => (
      <Checkbox
        {...field}
        checked={value === true}
        onCheckedChange={(checked) => onChange(checked)}
      />
    )}
  </FormBase>
);
