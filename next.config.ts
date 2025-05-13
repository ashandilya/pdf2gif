
import type {NextConfig} from 'next';
import path from 'path'; // Import path module

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent bundling of 'canvas' module on the client side
      // This is often needed when using pdfjs-dist on the client
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: path.join(__dirname, 'src/lib/empty-module.ts'), // Alias to an empty module
      };
    }
    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
