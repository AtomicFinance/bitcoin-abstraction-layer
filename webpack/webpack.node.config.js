const path = require('path');

const cwd = process.cwd();
const pkg = require(path.join(cwd, 'package.json'));

const isProdEnv = process.env.NODE_ENV === 'production';
const isWatchEnv = process.env.WEBPACK_WATCH === 'true';
const isCIEnv = process.env.CI === 'true';

module.exports = {
  mode: isProdEnv ? 'production' : 'development',
  watch: isWatchEnv,
  stats: isCIEnv ? undefined : 'minimal',
  devtool: isProdEnv ? 'source-map' : 'eval',
  target: 'node',
  entry: './lib/index.ts',
  output: {
    path: path.resolve(cwd, 'dist'),
    filename: path.basename(pkg.main),
    libraryTarget: 'commonjs2',
    libraryExport: pkg.umdExport ? pkg.umdExport : undefined,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /_wasm\.js$/,
        loader: 'exports-loader',
        options: {
          type: 'commonjs',
          exports: 'single Module',
        },
      },
      {
        test: /cfdjs_wasm_jsonapi\.js/,
        loader: 'exports-loader',
        options: {
          type: 'commonjs',
          exports: ['callJsonApi', 'ccallCfd', 'CfdError'],
        },
      },
    ],
  },
};
