import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Design Tokens Verification', () => {
  const tokensCssPath = path.resolve(__dirname, 'tokens.css');
  const designMdPath = path.resolve(__dirname, '../DESIGN.md');

  it('tokens.css exists and can be read', () => {
    expect(fs.existsSync(tokensCssPath)).toBe(true);
    expect(fs.existsSync(designMdPath)).toBe(true);
  });

  it('contains all colors from DESIGN.md frontmatter', () => {
    const css = fs.readFileSync(tokensCssPath, 'utf-8');
    const expectedColors: Record<string, string> = {
      'background': '#0a122a',
      'surface': '#0a122a',
      'surface-container-lowest': '#050d25',
      'surface-container-low': '#131a33',
      'surface-container': '#171e37',
      'surface-container-high': '#212942',
      'on-surface': '#dbe1ff',
      'on-surface-variant': '#c4c5d9',
      'outline': '#8e90a2',
      'outline-variant': '#434656',
      'primary': '#b8c4ff',
      'on-primary': '#002486',
      'primary-container': '#0e4bef',
      'on-primary-container': '#d1d7ff',
      'secondary': '#eec14b',
      'on-secondary': '#3e2e00',
      'secondary-container': '#b38b14',
      'on-secondary-container': '#362800',
      'status-ahead': '#10B981',
      'on-status-ahead': '#0a122a',
      'status-behind': '#EF4444',
      'on-status-behind': '#FFFFFF',
      'ivory': '#FBF7EE'
    };

    for (const [name, value] of Object.entries(expectedColors)) {
      const regex = new RegExp(`--(color-)?${name}:\\s*${value}`, 'i');
      expect(css).toMatch(regex);
    }
  });

  it('contains all spacing tokens from DESIGN.md frontmatter', () => {
    const css = fs.readFileSync(tokensCssPath, 'utf-8');
    const expectedSpacing: Record<string, string> = {
      'margin': '1rem',
      'gutter': '0.75rem',
      'space-xs': '0.25rem',
      'space-sm': '0.5rem',
      'space-md': '0.75rem',
      'space-lg': '1.25rem',
      'space-xl': '1.75rem'
    };

    for (const [name, value] of Object.entries(expectedSpacing)) {
      const regex = new RegExp(`--(spacing-)?${name}:\\s*${value}`, 'i');
      expect(css).toMatch(regex);
    }
  });

  it('contains all rounded tokens from DESIGN.md frontmatter', () => {
    const css = fs.readFileSync(tokensCssPath, 'utf-8');
    expect(css).toMatch(/--rounded(-default|-DEFAULT)?:\s*0\.25rem/i);
    expect(css).toMatch(/--rounded-lg:\s*0\.5rem/i);
    expect(css).toMatch(/--rounded-full:\s*9999px/i);
  });

  it('contains typography tokens for all styles in DESIGN.md', () => {
    const css = fs.readFileSync(tokensCssPath, 'utf-8');
    const styles = [
      'display',
      'headline-xl',
      'headline-lg',
      'headline-md',
      'body-lg',
      'body-md',
      'label-lg',
      'label-md'
    ];

    for (const style of styles) {
      expect(css).toContain(`--typography-${style}-font-family`);
      expect(css).toContain(`--typography-${style}-font-size`);
      expect(css).toContain(`--typography-${style}-font-weight`);
      expect(css).toContain(`--typography-${style}-line-height`);
    }
  });

  it('specifies 48px header button and at least 56px tab bar height tokens', () => {
    const css = fs.readFileSync(tokensCssPath, 'utf-8');
    expect(css).toMatch(/--header-button-size:\s*48px/);
    expect(css).toMatch(/--tab-bar-min-height:\s*56px/);
    expect(css).toMatch(/--tab-item-height:\s*56px/);
  });
});
