import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ShaderlabNextOptions {
  /**
   * Apply the non-standard `shader_frame.foo(fx) { ... }` transform before Next compiles app code.
   * Enabled by default for parity with the Vite plugin.
   */
  blockSyntax?: boolean;
}

type WebpackRule = Record<string, unknown>;

interface WebpackConfig {
  module?: {
    rules?: WebpackRule[];
  };
  resolve?: {
    extensions?: string[];
  };
}

export interface NextConfigLike {
  webpack?: (config: WebpackConfig, context: unknown) => WebpackConfig;
  [key: string]: unknown;
}

function addExtension(config: WebpackConfig, extension: string): void {
  config.resolve ??= {};
  const extensions = config.resolve.extensions ?? [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"];
  if (!extensions.includes(extension)) {
    config.resolve.extensions = [extension, ...extensions];
  } else {
    config.resolve.extensions = extensions;
  }
}

function addRule(config: WebpackConfig, rule: WebpackRule): void {
  config.module ??= {};
  config.module.rules ??= [];
  config.module.rules.push(rule);
}

function loaderPath(filename: string): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "next", filename);
}

/**
 * Experimental Next.js webpack-mode integration.
 *
 * Next apps must use webpack mode for now. Turbopack support is intentionally deferred.
 */
export function withShaderlab<TConfig extends NextConfigLike = NextConfigLike>(
  nextConfig: TConfig = {} as TConfig,
  options: ShaderlabNextOptions = {},
): TConfig {
  const userWebpack = nextConfig.webpack;
  const blockSyntax = options.blockSyntax !== false;

  return {
    ...nextConfig,
    webpack(config: WebpackConfig, context: unknown): WebpackConfig {
      const next = userWebpack ? userWebpack(config, context) : config;
      addExtension(next, ".slab");
      addRule(next, {
        test: /\.slab$/i,
        type: "javascript/auto",
        use: [{ loader: loaderPath("slab-loader.cjs") }],
      });
      if (blockSyntax) {
        addRule(next, {
          test: /\.[cm]?[jt]sx?$/i,
          exclude: /node_modules/,
          enforce: "pre",
          use: [{ loader: loaderPath("transform-loader.cjs") }],
        });
      }
      return next;
    },
  };
}

export default withShaderlab;
