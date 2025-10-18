//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
	mode: 'production', // Use production mode for optimizations (minification, tree shaking)

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
  plugins: [
    // Ignore optional cassandra-driver dependencies that are only needed for specific auth methods
    // kerberos: Used for Kerberos/GSSAPI authentication (DataStax Enterprise feature)
    // These are safe to ignore for standard Cassandra authentication
    new webpack.IgnorePlugin({
      resourceRegExp: /^kerberos$/,
      contextRegExp: /cassandra-driver/
    })
  ]
};

/** @type WebpackConfig */
const webviewConfig = {
  target: 'web', // Webviews run in a browser context
  mode: 'production',

  entry: './src/webviews/connectionForm/index.tsx', // React app entry point
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
  plugins: [
    // Define process.env for React and other libraries that expect Node.js globals
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ],
  performance: {
    hints: false // Suppress size warnings - React webviews are naturally larger
  }
};

/** @type WebpackConfig */
const queryResultsWebviewConfig = {
  target: 'web', // Webviews run in a browser context
  mode: 'production',

  entry: './src/webviews/queryResults/index.tsx', // Query results webview entry point
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview-query-results.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.webview.json'
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
  plugins: [
    // Define process.env for React and other libraries that expect Node.js globals
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ],
  performance: {
    hints: false // Suppress size warnings - React webviews are naturally larger
  }
};

module.exports = [ extensionConfig, webviewConfig, queryResultsWebviewConfig ];