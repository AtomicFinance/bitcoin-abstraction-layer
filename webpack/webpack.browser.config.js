const path = require('path');

const cwd = process.cwd();
const pkg = require(path.join(cwd, 'package.json'));

const libname = pkg.name.split('/')[1];
const isProdEnv = process.env.NODE_ENV === 'production';
const isWatchEnv = process.env.WEBPACK_WATCH === 'true';

const filename = `${libname}${isProdEnv ? '.min' : ''}.js`;

module.exports = {
  mode: isProdEnv ? 'production' : 'development',
  watch: isWatchEnv,
  devtool: isProdEnv ? 'source-map' : 'eval',
  target: 'web',
  entry: './lib/index.ts',
  output: {
    path: path.resolve(cwd, 'dist'),
    filename,
    library:
      pkg.umdName ||
      (function () {
        throw new Error(`Add "umdName" property to ${pkg.name}'s package.json`);
      })(),
    libraryTarget: 'umd',
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
  node: {
    fs: 'empty',
  },
};
