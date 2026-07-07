export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:4200',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  superAdminSecret: process.env.SUPER_ADMIN_SECRET ?? '',
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    user: process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'noreply@swarajya.com',
  },
});
