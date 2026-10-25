'use client';
import { Checkbox } from '__UI_PREFIX__checkbox';
import { useFieldContext } from './contexts';
import { FormBase, type FormControlProps } from './form-base';

export function FormCheckbox(props: FormControlProps) {
  const field = useFieldContext<boolean>();
  return (
    <FormBase {...props}>
      {(accessibility) => (
        <Checkbox
          {...accessibility}
          name={field.name}
          checked={field.state.value}
          disabled={props.disabled}
          onBlur={field.handleBlur}
          onCheckedChange={(checked) => field.handleChange(checked)}
        />
      )}
    </FormBase>
  );
}
