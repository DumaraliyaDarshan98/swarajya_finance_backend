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
  telephony: {
    provider: process.env.TELEPHONY_PROVIDER ?? 'exotel',
  },
  exotel: {
    accountSid: process.env.EXOTEL_ACCOUNT_SID ?? '',
    apiKey: process.env.EXOTEL_API_KEY ?? '',
    apiToken: process.env.EXOTEL_API_TOKEN ?? '',
    callerId: process.env.EXOTEL_CALLER_ID ?? '',
    webhook: process.env.EXOTEL_WEBHOOK ?? '',
    apiSubdomain: process.env.EXOTEL_API_SUBDOMAIN ?? 'api.in.exotel.com',
    flowAppIdInitialSubmission: process.env.EXOTEL_FLOW_APP_ID_INITIAL_SUBMISSION ?? '',
    flowAppIdAgentAssigned: process.env.EXOTEL_FLOW_APP_ID_AGENT_ASSIGNED ?? '',
    flowAppIdFinalReport: process.env.EXOTEL_FLOW_APP_ID_FINAL_REPORT ?? '',
    flowAppIdRecall: process.env.EXOTEL_FLOW_APP_ID_RECALL ?? '',
    flowAppIdCustom: process.env.EXOTEL_FLOW_APP_ID_CUSTOM ?? '',
  },
});
