// Optimized webpack config with SWC for faster builds
// Usage: webpack --config ./config/webpack-fast.ts

import type { Env, WebpackConfigurationGenerator } from './webpack';
import baseConfig from './webpack';

const config: WebpackConfigurationGenerator = async (env?: Env) => {
  if (!env) {
    throw new Error('Environment configuration is required');
  }

  const base = baseConfig(env);

  // Replace babel-loader with swc-loader for much faster builds
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
              loader: 'swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'typescript',
                    tsx: true,
                  },
                  target: 'es2020',
                  transform: {
                    react: {
                      runtime: 'automatic',
                      refresh: env?.dev || false,
                    },
                  },
                },
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
              loader: 'swc-loader',
              options: {
                jsc: {
                  parser: {
                    syntax: 'ecmascript',
                  },
                  target: 'es2020',
                },
              },
            },
          ],
        };
      }
      return rule;
    });
  }

  return base;
};

export default config;
