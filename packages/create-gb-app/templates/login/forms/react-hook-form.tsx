'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '__UI_PREFIX__button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '__UI_PREFIX__card';
import { FieldDescription, FieldGroup } from '__UI_PREFIX__field';
import { useForm } from 'react-hook-form';
import { FormInput } from '@/components/form/form-input';

type LoginValues = { name: string; email: string; password: string };

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    defaultValues: { name: '', email: '', password: '' },
  });
  const pending = form.formState.isSubmitting;
  async function submit(values: LoginValues) {
    setError(null);
    try {
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({
              email: values.email,
              password: values.password,
              name: values.name,
            })
          : await authClient.signIn.email({
              email: values.email,
              password: values.password,
            });
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed');
        return;
      }
      onSuccess();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Authentication failed'
      );
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {mode === 'signin' ? 'Welcome back' : 'Create an account'}
        </CardTitle>
        <CardDescription>
          {mode === 'signin'
            ? 'Sign in with your email and password.'
            : 'Enter your details to get started.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(submit)}>
          <FieldGroup>
            {mode === 'signup' ? (
              <FormInput
                control={form.control}
                name="name"
                label="Name"
                autoComplete="name"
                required
                disabled={pending}
              />
            ) : null}
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="m@example.com"
              required
              disabled={pending}
            />
            <FormInput
              control={form.control}
              name="password"
              label="Password"
              type="password"
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              required
              disabled={pending}
            />
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Please wait…'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </Button>
            <FieldDescription className="text-center">
              {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError(null);
                }}
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
