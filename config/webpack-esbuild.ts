// Alternative webpack config using esbuild for faster builds
// Usage: Set WEBPACK_CONFIG=esbuild in your environment

import { EsbuildPlugin } from 'esbuild-loader';
import type { Env, WebpackConfigurationGenerator } from './webpack';
import baseConfig from './webpack';

const config: WebpackConfigurationGenerator = async (env?: Env) => {
  if (!env) {
    throw new Error('Environment configuration is required');
  }

  const base = baseConfig(env);

  // Replace babel-loader with esbuild-loader
  if (base.module?.rules) {
    base.module.rules = base.module.rules.map((rule) => {
      if (
        rule &&
        typeof rule === 'object' &&
        'test' in rule &&
        rule.test instanceof RegExp &&
        rule.test.source.includes('tsx?')
      ) {
        return {
          test: /\.tsx?$/,
          exclude: [/testing/, /\.test\.ts$/],
          use: [
            {
              loader: 'esbuild-loader',
              options: {
                loader: 'tsx',
                target: 'es2020',
                jsx: 'automatic',
              },
            },
          ],
        };
      }
      if (
        rule &&
        typeof rule === 'object' &&
        'test' in rule &&
        rule.test instanceof RegExp &&
        rule.test.source.includes('\\.js$')
      ) {
        return {
          test: /\.js$/,
          exclude: [/node_modules/, /browsercheck\.js$/],
          use: [
            {
              loader: 'esbuild-loader',
              options: {
                loader: 'js',
                target: 'es2020',
              },
            },
          ],
        };
      }
      return rule;
    });
  }

  // Replace TerserPlugin with EsbuildPlugin
  if (base.optimization) {
    base.optimization.minimizer = [
      new EsbuildPlugin({
        target: 'es2020',
        legalComments: 'none',
        css: true,
      }),
    ];
  }

  return base;
};

export default config;
