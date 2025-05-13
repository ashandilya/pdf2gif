/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Alias 'canvas' module for pdfjs-dist on the client-side
    // pdfjs-dist tries to require('canvas') which is Node-specific.
    // We alias it to an empty module for client builds to avoid errors.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Ensure this path points to your empty module file
        canvas: path.join(__dirname, 'src/lib/empty-module.ts'),
      };
    }

    // This rule is sometimes needed if pdfjs-dist includes problematic code
    // that webpack tries to parse even with the alias. This tells webpack
    // not to parse the pdf.js file itself for requires/imports, relying
    // on it being correctly bundled for its target environment.
    // Use with caution, might hide other issues.
    // config.module.noParse = /pdfjs-dist\/build\/pdf\.js$/;

    // Important: return the modified config
    return config;
  },
};

module.exports = nextConfig; 