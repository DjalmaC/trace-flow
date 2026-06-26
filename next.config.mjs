/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    // pptxgenjs (used client-side for the PowerPoint export) references Node
    // builtins for its server file-write path; in the browser it downloads via
    // Blob. Rewrite the node:* scheme imports to bare names, then stub them.
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:(fs|https|http)$/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
      };
    }
    return config;
  },
};

export default nextConfig;
