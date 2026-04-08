#!/bin/bash
set -e

echo "🌿 ISPANI Dev Setup Starting..."

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
sudo apt-get update -qq
sudo apt-get install -y -qq postgresql postgresql-client redis-server > /dev/null 2>&1

# Start PostgreSQL
echo "🐘 Starting PostgreSQL..."
sudo service postgresql start

# Create database and user
sudo -u postgres psql -c "CREATE USER ispani WITH PASSWORD 'ispani123' CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE ispani OWNER ispani;" 2>/dev/null || true

# Start Redis
echo "🔴 Starting Redis..."
sudo service redis-server start

# Create .env file
echo "⚙️  Creating .env..."
cat > .env << 'EOF'
DATABASE_URL=postgresql://ispani:ispani123@localhost:5432/ispani
JWT_SECRET=ispani-dev-secret-key-change-in-production
JWT_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
EOF

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Generate Prisma client
echo "🔷 Generating Prisma client..."
npx prisma generate

# Run migrations
echo "🗃️  Running database migrations..."
npx prisma migrate dev --name init --skip-seed 2>/dev/null || npx prisma db push

echo ""
echo "✅ ISPANI Dev Environment Ready!"
echo "────────────────────────────────"
echo "  Database: postgresql://localhost:5432/ispani"
echo "  Redis:    redis://localhost:6379"
echo "  Run:      npm run dev"
echo "  Test:     npm test"
echo "────────────────────────────────"
