const path = require("node:path");

function addExtension(config, extension) {
  config.resolve ??= {};
  const extensions = config.resolve.extensions ?? [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"];
  if (!extensions.includes(extension)) {
    config.resolve.extensions = [extension, ...extensions];
  } else {
    config.resolve.extensions = extensions;
  }
}

function addRule(config, rule) {
  config.module ??= {};
  config.module.rules ??= [];
  config.module.rules.push(rule);
}

function withShaderlab(nextConfig = {}, options = {}) {
  const userWebpack = nextConfig.webpack;
  const blockSyntax = options.blockSyntax !== false;

  return {
    ...nextConfig,
    webpack(config, context) {
      const next = userWebpack ? userWebpack(config, context) : config;
      addExtension(next, ".slab");
      addRule(next, {
        test: /\.slab$/i,
        type: "javascript/auto",
        use: [{ loader: path.join(__dirname, "slab-loader.cjs") }],
      });
      if (blockSyntax) {
        addRule(next, {
          test: /\.[cm]?[jt]sx?$/i,
          exclude: /node_modules/,
          enforce: "pre",
          use: [{ loader: path.join(__dirname, "transform-loader.cjs") }],
        });
      }
      return next;
    },
  };
}

module.exports = withShaderlab;
module.exports.withShaderlab = withShaderlab;
module.exports.default = withShaderlab;
