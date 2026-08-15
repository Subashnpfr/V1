/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Offline-first app: no remote image optimization needed
  images: {
    unoptimized: true,
  },
};
