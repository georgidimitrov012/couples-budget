import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { ScreenHeader } from '../../src/components/screen-header';

describe('ScreenHeader', () => {
  it('renders the title', async () => {
    await render(<ScreenHeader title="Списък за пазаруване" />);
    expect(screen.getByText('Списък за пазаруване')).toBeTruthy();
  });

  it('renders the action alongside the title', async () => {
    await render(
      <ScreenHeader title="Статистика">
        <Text>Готово</Text>
      </ScreenHeader>,
    );
    expect(screen.getByText('Статистика')).toBeTruthy();
    expect(screen.getByText('Готово')).toBeTruthy();
  });

  it('omits the action slot entirely when there is no action', async () => {
    // The list screen renders no action until something is checked; an empty
    // wrapper would still eat a gap on the right.
    const { toJSON } = await render(<ScreenHeader title="Списък" />);
    const tree = toJSON() as { children: unknown[] };
    expect(tree.children).toHaveLength(1);
  });

  // The bug this component exists to prevent: a long title used to take its full
  // intrinsic width and push the action off the edge of the screen.
  it('lets the title shrink and wrap rather than clip the action', async () => {
    await render(
      <ScreenHeader title="Повтарящи се разходи">
        <Text>Готово</Text>
      </ScreenHeader>,
    );
    const title = screen.getByText('Повтарящи се разходи');
    expect(StyleSheet.flatten(title.props.style).flexShrink).toBe(1);
    expect(title.props.numberOfLines).toBe(2);
  });

  it('keeps the action from shrinking', async () => {
    await render(
      <ScreenHeader title="Повтарящи се разходи">
        <Text testID="action">Готово</Text>
      </ScreenHeader>,
    );
    const wrapper = screen.getByTestId('action').parent;
    expect(StyleSheet.flatten(wrapper?.props.style).flexShrink).toBe(0);
  });

  // The opposite bug: a wide action (Budget's links in Bulgarian) squeezed the
  // title to "Бю / д…". The row wraps, so the action drops to its own line
  // (still right-aligned) instead of crushing the title.
  it('wraps a wide action onto its own line instead of crushing the title', async () => {
    const { toJSON } = await render(
      <ScreenHeader title="Бюджет">
        <Text testID="action">Статистика Категории Повтарящи се</Text>
      </ScreenHeader>,
    );
    const row = toJSON() as { props: { style: unknown } };
    expect(StyleSheet.flatten(row.props.style as never).flexWrap).toBe('wrap');
    const wrapper = screen.getByTestId('action').parent;
    expect(StyleSheet.flatten(wrapper?.props.style).marginLeft).toBe('auto');
  });
});
