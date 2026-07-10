import React from 'react';
import { render } from '@testing-library/react-native';

/**
 * Asserts that calling `useHook` outside its provider throws a matching error.
 * React 19's renderHook doesn't surface render-time throws to the caller, so we
 * catch it with an error boundary instead. render() is async under RTL-RN v14.
 */
export async function expectHookToThrow(useHook: () => unknown, pattern: RegExp) {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  let error: Error | undefined;

  class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch(e: Error) {
      error = e;
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }

  function Probe() {
    useHook();
    return null;
  }

  await render(
    <Boundary>
      <Probe />
    </Boundary>
  );
  spy.mockRestore();
  expect(error?.message ?? '').toMatch(pattern);
}
