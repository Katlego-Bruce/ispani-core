const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

function validateEnv() {
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

module.exports = { validateEnv };
