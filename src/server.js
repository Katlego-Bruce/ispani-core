require('dotenv').config();

const { validateEnv } = require('./config/env');
const config = require('./config');
const app = require('./app');

// Validate environment
validateEnv();

app.listen(config.PORT, () => {
  console.log(`🚀 ISPANI API running on port ${config.PORT}`);
  console.log(`📍 Environment: ${config.NODE_ENV}`);
  console.log(`🔗 Health: http://localhost:${config.PORT}/health`);
});
