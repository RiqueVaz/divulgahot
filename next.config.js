/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Só aplica no lado do servidor (onde roda a API)
    if (isServer) {
      // Diz ao Webpack para não empacotar a biblioteca 'telegram'
      config.externals.push('telegram');
    }
    return config;
  },
};

module.exports = nextConfig;
