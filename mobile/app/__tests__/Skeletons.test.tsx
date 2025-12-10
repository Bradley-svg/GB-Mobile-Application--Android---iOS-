import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ListSkeleton } from '../components/ListSkeleton';
import { SkeletonPlaceholder } from '../components/SkeletonPlaceholder';
import { ThemeContext } from '../theme/ThemeProvider';
import { lightTheme } from '../theme/themes';

const renderWithTheme = (ui: React.ReactElement) =>
  render(
    <ThemeContext.Provider
      value={{
        theme: lightTheme,
        mode: 'light',
        resolvedScheme: 'light',
        setMode: jest.fn(),
        isReady: true,
      }}
    >
      {ui}
    </ThemeContext.Provider>
  );

describe('shared skeleton components', () => {
  it('renders the configured number of list skeleton rows', () => {
    renderWithTheme(<ListSkeleton rows={4} testID="list-skeleton" />);

    expect(screen.getAllByTestId('list-skeleton-row')).toHaveLength(4);
  });

  it('applies themed colors and sizing to skeleton placeholders', () => {
    const { toJSON } = renderWithTheme(
      <SkeletonPlaceholder width={120} height={10} style={{ marginTop: 4 }} />
    );
    const tree = toJSON() as { props: { style: unknown } };
    const mergedStyle = Array.isArray(tree.props.style)
      ? tree.props.style.reduce((acc, entry) => ({ ...acc, ...entry }), {})
      : (tree.props.style as Record<string, unknown>);

    expect(mergedStyle.backgroundColor).toBe(lightTheme.colors.backgroundAlt);
    expect(mergedStyle.height).toBe(10);
    expect(mergedStyle.width).toBe(120);
  });
});
