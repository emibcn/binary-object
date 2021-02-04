const path = require('path');

module.exports = [
  'source-map'
].map(devtool => ({
  mode: 'production',
  entry: path.resolve(__dirname, './src/index.js'),
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'BinaryObject',
    libraryTarget: 'umd',
    globalObject: 'global',
  },
  devtool,
}));
