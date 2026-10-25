'use client';

import { useId, type ReactNode } from 'react';
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '__UI_PREFIX__field';

export type FormControlProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  TOutput = TValues,
> = {
  control: ControllerProps<TValues, TName, TOutput>['control'];
  name: TName;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  fieldClassName?: string;
};

export type FormControlFn<TExtra = Record<never, never>> = <
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  TOutput = TValues,
>(
  props: FormControlProps<TValues, TName, TOutput> & TExtra
) => ReactNode;

type ControlState<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  TOutput,
> = Parameters<
  ControllerProps<TValues, TName, TOutput>['render']
>[0]['field'] & {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

export function FormBase<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  TOutput = TValues,
>({
  children,
  control,
  name,
  label,
  description,
  disabled,
  fieldClassName,
}: FormControlProps<TValues, TName, TOutput> & {
  children: (field: ControlState<TValues, TName, TOutput>) => ReactNode;
}) {
  const id = useId();
  // Keep values registered while pending; Controller disabled omits them on retries.
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          data-disabled={disabled || field.disabled}
          className={fieldClassName}
        >
          {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
          {children({
            ...field,
            disabled: disabled || field.disabled,
            id,
            'aria-invalid': fieldState.invalid,
            'aria-describedby':
              [
                description ? id + '-description' : null,
                fieldState.invalid ? id + '-error' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined,
          })}
          {description ? (
            <FieldDescription id={id + '-description'}>
              {description}
            </FieldDescription>
          ) : null}
          {fieldState.invalid ? (
            <FieldError id={id + '-error'} errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}
