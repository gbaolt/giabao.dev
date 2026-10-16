'use client';
import type { FieldPath, FieldPathValue, FieldValues } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormBase, type FormControlProps } from './form-base';

export function FormSelect<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
  TOutput = TValues,
>({
  options,
  placeholder,
  onValueChange,
  ...props
}: FormControlProps<TValues, TName, TOutput> & {
  options: { label: string; value: FieldPathValue<TValues, TName> }[];
  placeholder?: string;
  onValueChange?: (value: FieldPathValue<TValues, TName> | null) => void;
}) {
  return (
    <FormBase {...props}>
      {({ value, onChange, onBlur, ref, ...field }) => (
        <Select<FieldPathValue<TValues, TName>>
          items={options}
          value={value}
          name={field.name}
          disabled={field.disabled}
          onValueChange={(next) => {
            onChange(next);
            onValueChange?.(next);
          }}
        >
          <SelectTrigger {...field} ref={ref} onBlur={onBlur}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={String(option.value)} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </FormBase>
  );
}
