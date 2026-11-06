/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg', 'web-push'],
  // The Musculation section was removed: old bookmarks and installed apps land on the home page.
  async redirects() {
    return [
      { source: '/muscu/:path*', destination: '/', permanent: false },
      // Bank moved from Business to personal finances.
      { source: '/entrepreneuriat/banque', destination: '/finances/banque', permanent: false },
      { source: '/entrepreneuriat/investir', destination: '/finances/investir', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};
export default nextConfig;
