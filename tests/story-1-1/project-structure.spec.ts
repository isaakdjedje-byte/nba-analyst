import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(process.cwd());

test.describe('Story 1.1: Project Structure', () => {
  test('package.json exists with required scripts', async () => {
    const packageJsonPath = resolve(projectRoot, 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);
    
    const packageJson = await import(packageJsonPath);
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts.dev).toBeDefined();
    expect(packageJson.scripts.build).toBeDefined();
    expect(packageJson.scripts.start).toBeDefined();
    expect(packageJson.scripts.lint).toBeDefined();
  });

  test('TypeScript configuration exists', () => {
    expect(existsSync(resolve(projectRoot, 'tsconfig.json'))).toBe(true);
    expect(existsSync(resolve(projectRoot, 'next-env.d.ts'))).toBe(true);
  });

  test('ESLint configuration exists', () => {
    const hasEslintConfig = 
      existsSync(resolve(projectRoot, 'eslint.config.mjs')) ||
      existsSync(resolve(projectRoot, 'eslint.config.js')) ||
      existsSync(resolve(projectRoot, '.eslintrc.json'));
    expect(hasEslintConfig).toBe(true);
  });

  test('Tailwind CSS configuration exists', () => {
    const hasTailwindConfig = 
      existsSync(resolve(projectRoot, 'tailwind.config.ts')) ||
      existsSync(resolve(projectRoot, 'tailwind.config.js'));
    expect(hasTailwindConfig).toBe(true);
  });

  test('PostCSS configuration exists', () => {
    const hasPostcssConfig = 
      existsSync(resolve(projectRoot, 'postcss.config.mjs')) ||
      existsSync(resolve(projectRoot, 'postcss.config.js')) ||
      existsSync(resolve(projectRoot, 'postcss.config.cjs'));
    expect(hasPostcssConfig).toBe(true);
  });

  test('Next.js configuration exists', () => {
    const hasNextConfig = 
      existsSync(resolve(projectRoot, 'next.config.mjs')) ||
      existsSync(resolve(projectRoot, 'next.config.ts')) ||
      existsSync(resolve(projectRoot, 'next.config.js'));
    expect(hasNextConfig).toBe(true);
  });

  test('src/app directory exists with required files', () => {
    expect(existsSync(resolve(projectRoot, 'src', 'app'))).toBe(true);
    expect(existsSync(resolve(projectRoot, 'src', 'app', 'layout.tsx'))).toBe(true);
    expect(existsSync(resolve(projectRoot, 'src', 'app', 'page.tsx'))).toBe(true);
  });

  test('src/components directory exists', () => {
    expect(existsSync(resolve(projectRoot, 'src', 'components'))).toBe(true);
  });

  test('public directory exists for static assets', () => {
    expect(existsSync(resolve(projectRoot, 'public'))).toBe(true);
  });

  test('globals.css exists with Tailwind imports', () => {
    const globalsCssPath = resolve(projectRoot, 'src', 'app', 'globals.css');
    expect(existsSync(globalsCssPath)).toBe(true);
    
    const fs = require('fs');
    const content = fs.readFileSync(globalsCssPath, 'utf-8');
    expect(content).toContain('@tailwind');
  });

  test('.gitignore exists with standard patterns', () => {
    expect(existsSync(resolve(projectRoot, '.gitignore'))).toBe(true);
    
    const fs = require('fs');
    const content = fs.readFileSync(resolve(projectRoot, '.gitignore'), 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('.next');
  });

  test('.env.example exists', () => {
    expect(existsSync(resolve(projectRoot, '.env.example'))).toBe(true);
  });
});
