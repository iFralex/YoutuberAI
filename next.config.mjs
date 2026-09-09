/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverActions: {
        bodySizeLimit: '6mb',
      },
    },
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'yt3.ggpht.com',
            port: '',
            pathname: '/ytc/**',
          },
        ],
      },
    
};

export default nextConfig;
