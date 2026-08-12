import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AnimatedSplashOverlay } from '../../src/components/animated-icon';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// The overlay exists to redraw the native splash so the handoff is invisible, so
// its ground and mark size have to track app.json's expo-splash-screen config.
const appJson = require('../../app.json');
const splashConfig = appJson.expo.plugins.find(
  (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
)[1];

describe('AnimatedSplashOverlay', () => {
  it('shows the brand mark, not the Expo template logo', async () => {
    await render(<AnimatedSplashOverlay />);
    // expo-image normalizes `source` into an array, so flatten before comparing.
    const source = [screen.getByTestId('splash-mark').props.source].flat();
    expect(source).toContainEqual(require('../../assets/images/splash-icon.png'));
  });

  it('matches the native splash background so the handoff does not flash', async () => {
    await render(<AnimatedSplashOverlay />);
    const style = StyleSheet.flatten(screen.getByTestId('splash-overlay').props.style);
    expect(style.backgroundColor).toBe(splashConfig.backgroundColor);
  });

  it('draws the mark at the same size as the native splash', async () => {
    await render(<AnimatedSplashOverlay />);
    const style = StyleSheet.flatten(screen.getByTestId('splash-mark').props.style);
    expect(style.width).toBe(splashConfig.imageWidth);
    // The mark is square, so height has to follow width or it would letterbox.
    expect(style.height).toBe(splashConfig.imageWidth);
  });

  it('covers the screen above the app content', async () => {
    await render(<AnimatedSplashOverlay />);
    const style = StyleSheet.flatten(screen.getByTestId('splash-overlay').props.style);
    expect(style.position).toBe('absolute');
    expect(style.zIndex).toBe(1000);
  });
});
