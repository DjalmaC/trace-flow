/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The gated PDFs live outside /public; make sure Vercel ships them inside the
  // /api/asset serverless function bundle so readFile() can find them at runtime.
  outputFileTracingIncludes: {
    "/api/asset/[name]": ["./private-assets/**"],
    // The OG preview card reads its backdrop, wordmark and fonts off disk.
    "/api/og/[key]": [
      "./public/assets/bg/silk.jpg",
      "./public/assets/trace-logo-white.svg",
      "./public/fonts/inter-600.ttf",
      "./public/fonts/inter-700.ttf",
    ],
  },
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
