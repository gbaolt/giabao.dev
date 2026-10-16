'use client';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFieldContext } from './contexts';
import { FormBase, type FormControlProps } from './form-base';

export function FormSelect<TValue extends string>({
  options,
  placeholder,
  ...props
}: FormControlProps & {
  options: { label: string; value: TValue }[];
  placeholder?: string;
}) {
  const field = useFieldContext<TValue | null>();
  return (
    <FormBase {...props}>
      {(accessibility) => (
        <Select<TValue>
          items={options}
          value={field.state.value}
          name={field.name}
          disabled={props.disabled}
          onValueChange={(value) => field.handleChange(value)}
        >
          <SelectTrigger
            {...accessibility}
            onBlur={field.handleBlur}
            disabled={props.disabled}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
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
