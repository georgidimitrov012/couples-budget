// Jest setup (runs after the test framework is installed).
// @testing-library/react-native v14 registers its matchers on import.
import '@testing-library/react-native';

// React 19's concurrent renderer only flushes state updates under test when this
// flag is set; without it, effect-driven updates never settle and waitFor() hangs.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Shared lightweight mocks for native/navigation modules the screens pull in.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, props, children),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) => children,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
