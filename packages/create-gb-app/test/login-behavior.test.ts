import { expect, test } from 'bun:test';
import { createElement, isValidElement } from 'react';
import ts from 'typescript';

import { buildTree, resolveStack } from '#/generate/public';

function loginSource(form: 'none' | 'react-hook-form' | 'tanstack-form') {
  return ts.createSourceFile(
    'login-form.tsx',
    buildTree(resolveStack({ yes: true, form }), {
      projectName: 'login-behavior',
      packageManager: 'bun',
    })['components/login-form.tsx'],
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function evaluate(source: string, bindings: Record<string, unknown>): unknown {
  const compilation = ts.transpileModule(`const value = (${source});`, {
    fileName: 'login-callback.tsx',
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
      jsxFactory: 'createElement',
    },
  });
  expect(compilation.diagnostics).toEqual([]);
  return new Function(
    ...Object.keys(bindings),
    compilation.outputText + '\nreturn value;'
  )(...Object.values(bindings));
}

for (const mode of ['signin', 'signup'] as const) {
  test(`TanStack ${mode} locks inputs while submitting and unlocks afterward`, () => {
    const source = loginSource('tanstack-form');
    const component = source.statements.find(
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === 'LoginForm'
    );
    const view = component?.body?.statements.find(
      ts.isReturnStatement
    )?.expression;
    if (!view) throw new Error('Missing login form view');
    const tree = evaluate(view.getText(source), {
      createElement,
      mode,
      error: null,
      form: {
        AppForm: 'app-form',
        AppField: 'app-field',
        Subscribe: 'subscribe',
      },
      Card: 'section',
      CardHeader: 'header',
      CardTitle: 'h1',
      CardDescription: 'p',
      CardContent: 'div',
      FieldGroup: 'fieldset',
      FieldDescription: 'p',
      Button: 'button',
      setMode() {},
      setError() {},
    });
    for (const pending of [false, true, false]) {
      const inputs: { name: string | undefined; disabled: boolean }[] = [];
      const buttons: boolean[] = [];
      const inspect = (node: unknown, fieldName?: string): void => {
        if (Array.isArray(node)) {
          for (const child of node) inspect(child, fieldName);
        } else if (
          isValidElement<{
            children?: unknown;
            name?: string;
            type?: string;
            disabled?: boolean;
          }>(node)
        ) {
          if (node.type === 'subscribe' || node.type === 'app-field') {
            const render = node.props.children;
            if (typeof render !== 'function')
              throw new Error('Missing form render callback');
            inspect(
              render(node.type === 'subscribe' ? pending : { Input: 'input' }),
              node.type === 'app-field' ? node.props.name : fieldName
            );
          } else {
            if (node.type === 'input')
              inputs.push({
                name: fieldName,
                disabled: Boolean(node.props.disabled),
              });
            if (node.type === 'button' && node.props.type === 'submit')
              buttons.push(Boolean(node.props.disabled));
            inspect(node.props.children, fieldName);
          }
        }
      };
      inspect(tree);
      expect(inputs).toEqual(
        (mode === 'signup'
          ? ['name', 'email', 'password']
          : ['email', 'password']
        ).map((name) => ({ name, disabled: pending }))
      );
      expect(buttons).toEqual([pending]);
    }
  });
}

for (const form of ['none', 'react-hook-form', 'tanstack-form'] as const) {
  for (const mode of ['signin', 'signup'] as const) {
    test(`${form} ${mode} reports failures and allows retry`, async () => {
      const source = loginSource(form);
      let handler: ts.Node | undefined;
      const visit = (node: ts.Node): void => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === 'submit') {
          handler = node;
        } else if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(source) === 'onSubmit'
        ) {
          handler = node.initializer;
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (!handler) throw new Error('Missing login submission');

      const errors: (string | null)[] = [];
      const pending: boolean[] = [];
      let successes = 0;
      let reject = true;
      let failure: unknown = new TypeError('Failed to fetch');
      let response: { error: { message: string } | null } = { error: null };
      const credentials = {
        name: 'Example',
        email: 'example@example.com',
        password: 'fixture-only',
      };
      const requests: unknown[] = [];
      const request = async (input: unknown) => {
        requests.push(input);
        if (reject) throw failure;
        return response;
      };
      const submit = evaluate(handler.getText(source), {
        authClient: { signIn: { email: request }, signUp: { email: request } },
        mode,
        ...credentials,
        setError: (value: string | null) => errors.push(value),
        setPending: (value: boolean) => pending.push(value),
        onSuccess: () => {
          successes++;
        },
      });
      if (typeof submit !== 'function')
        throw new Error('Invalid login submission');
      const input = { ...credentials, value: credentials, preventDefault() {} };

      await submit(input);
      expect(errors).toEqual([null, 'Failed to fetch']);
      expect(successes).toBe(0);
      if (form === 'none') expect(pending).toEqual([true, false]);

      failure = 'connection lost';
      await submit(input);
      expect(errors.at(-1)).toBe('Authentication failed');
      expect(successes).toBe(0);

      reject = false;
      response = { error: { message: 'Invalid credentials' } };
      await submit(input);
      expect(errors.at(-1)).toBe('Invalid credentials');
      expect(successes).toBe(0);

      response = { error: null };
      await submit(input);
      expect(errors.at(-1)).toBeNull();
      expect(successes).toBe(1);
      expect(requests.at(-1)).toEqual(
        mode === 'signup'
          ? credentials
          : {
              email: credentials.email,
              password: credentials.password,
            }
      );
      if (form === 'none') expect(pending.at(-1)).toBe(false);
    });
  }
}
