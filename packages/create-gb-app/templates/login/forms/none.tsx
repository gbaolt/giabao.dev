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
import { Input } from '__UI_PREFIX__input';
import { Field, FieldLabel } from '__UI_PREFIX__field';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed');
        return;
      }
      onSuccess();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Authentication failed'
      );
    } finally {
      setPending(false);
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
        <form onSubmit={submit}>
          <FieldGroup>
            {mode === 'signup' ? (
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={pending}
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="m@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={pending}
              />
            </Field>
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
