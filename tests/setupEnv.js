'use strict';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.TOKEN_SECRETS = 'test-access-secret';
process.env.REFRESHTOKEN_SECRETS = 'test-refresh-secret';
process.env.EXPIRES_TIME_TOKEN = '300s';
process.env.EXPIRES_TIME_REFRESHTOKEN = '1800s';
process.env.SALTROUND = '4';
process.env.FRONTEND_URL = 'http://localhost:3001';
process.env.PORT = '3001';
