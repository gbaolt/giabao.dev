'use client';
import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from './contexts';
import { FormInput } from './form-input';
import { FormTextarea } from './form-textarea';
import { FormSelect } from './form-select';
import { FormCheckbox } from './form-checkbox';
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Input: FormInput,
    Textarea: FormTextarea,
    Select: FormSelect,
    Checkbox: FormCheckbox,
  },
  formComponents: {},
});
