/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Prevent Node.js-only onnxruntime bindings from being bundled for the browser
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    };
    return config;
  },
};

export default nextConfig;
