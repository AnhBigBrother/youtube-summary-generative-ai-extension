const path = require("path")
const CopyPlugin = require("copy-webpack-plugin")
const webpack = require("webpack")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

module.exports = {
	mode: "production",
	entry: {
		content: "./content.js",
	},
	output: {
		filename: "[name].bundle.js",
		path: path.resolve(__dirname, "dist"),
		clean: true,
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: "babel-loader",
					options: {
						presets: [
							[
								"@babel/preset-env",
								{
									targets: {
										chrome: "58",
									},
									modules: "auto",
								},
							],
						],
					},
				},
			},
		],
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{
					from: "styles",
					to: "styles",
					noErrorOnMissing: true,
				},
				{
					from: "images",
					to: "images",
					noErrorOnMissing: true,
				},
				{
					from: "manifest.json",
					to: "manifest.json",
					noErrorOnMissing: true,
				},
			],
		}),
		// Add environment variables
		new webpack.DefinePlugin({
			"process.env": JSON.stringify(process.env),
		}),
	],
	resolve: {
		fallback: {
			path: false,
			fs: false,
		},
	},
	experiments: {
		topLevelAwait: true,
	},
}
