import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary } from '../../src/components/error-boundary';

// A child that throws on render; used to trip the boundary.
function Boom() {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', async () => {
    await render(
      <ErrorBoundary>
        <Text>all good</Text>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeTruthy();
  });

  it('shows the recovery screen when a child throws', async () => {
    // React logs caught errors via console.error; silence it for a clean run.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    spy.mockRestore();
  });

  it('recovers when Try again is pressed and children stop throwing', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function Maybe() {
      if (shouldThrow) throw new Error('nope');
      return <Text>recovered</Text>;
    }
    const user = userEvent.setup();
    await render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();

    shouldThrow = false;
    await user.press(screen.getByRole('button'));
    expect(screen.getByText('recovered')).toBeTruthy();
    spy.mockRestore();
  });
});
