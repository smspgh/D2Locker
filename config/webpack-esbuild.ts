// Alternative webpack config using esbuild for faster builds
// Usage: Set WEBPACK_CONFIG=esbuild in your environment

import { EsbuildPlugin } from 'esbuild-loader';
import baseConfig from './webpack';
import type { Env, WebpackConfigurationGenerator } from './webpack';

const config: WebpackConfigurationGenerator = async (env?: Env) => {
  const base = await baseConfig(env);
  
  // Replace babel-loader with esbuild-loader
  base.module.rules = base.module.rules.map(rule => {
    if (rule.test?.toString().includes('tsx?')) {
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
    if (rule.test?.toString().includes('\.js$')) {
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

  // Replace TerserPlugin with EsbuildPlugin
  base.optimization.minimizer = [
    new EsbuildPlugin({
      target: 'es2020',
      legalComments: 'none',
      css: true,
    }),
  ];

  return base;
};

export default config;