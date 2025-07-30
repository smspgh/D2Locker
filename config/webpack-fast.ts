// Optimized webpack config with SWC for faster builds
// Usage: webpack --config ./config/webpack-fast.ts

import baseConfig from './webpack';
import type { Env, WebpackConfigurationGenerator } from './webpack';

const config: WebpackConfigurationGenerator = async (env?: Env) => {
  const base = await baseConfig(env);
  
  // Replace babel-loader with swc-loader for much faster builds
  base.module.rules = base.module.rules.map(rule => {
    if (rule.test?.toString().includes('tsx?')) {
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
                    refresh: env.dev,
                  },
                },
              },
            },
          },
        ],
      };
    }
    if (rule.test?.toString().includes('\.js$')) {
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

  return base;
};

export default config;