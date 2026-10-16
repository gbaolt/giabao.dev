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
import { useAppForm } from '@/components/form/hooks';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { name: '', email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError(null);
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({
              email: value.email,
              password: value.password,
              name: value.name,
            })
          : await authClient.signIn.email({
              email: value.email,
              password: value.password,
            });
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed');
        return;
      }
      onSuccess();
    },
  });

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
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.AppForm>
            <FieldGroup>
              {mode === 'signup' ? (
                <form.AppField name="name">
                  {(field) => (
                    <field.Input label="Name" autoComplete="name" required />
                  )}
                </form.AppField>
              ) : null}
              <form.AppField name="email">
                {(field) => (
                  <field.Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.Input
                    label="Password"
                    type="password"
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    required
                  />
                )}
              </form.AppField>
              {error ? (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              ) : null}
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(pending) => (
                  <Button type="submit" disabled={pending}>
                    {pending
                      ? 'Please wait…'
                      : mode === 'signin'
                        ? 'Sign in'
                        : 'Create account'}
                  </Button>
                )}
              </form.Subscribe>
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
          </form.AppForm>
        </form>
      </CardContent>
    </Card>
  );
}
