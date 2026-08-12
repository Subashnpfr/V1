// next.config.js – minimal configuration for the V1 frontend
module.exports = {
  // Enable React strict mode for better dev warnings
  reactStrictMode: true,
  // Allow images from any source (adjust as needed for production)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
    ],
  },
  // Future‑proof experimental flags (can be removed when not needed)
  experimental: {
    appDir: true,
  },
};