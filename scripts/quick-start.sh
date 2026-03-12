#!/bin/bash

# Redis Telemetry Architecture - Quick Start Guide
# This script automates the setup and startup of the system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Redis Telemetry Architecture - Quick Start${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites installed${NC}\n"

# Step 1: Environment Setup
echo -e "${YELLOW}📝 Step 1: Setting up environment variables...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file. Please review and update if needed.${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists. Skipping...${NC}"
fi
echo ""

# Step 2: Install dependencies
echo -e "${YELLOW}📦 Step 2: Installing Node.js dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}\n"

# Step 3: Start Docker containers
echo -e "${YELLOW}🐳 Step 3: Starting Docker containers...${NC}"
docker-compose up -d
echo -e "${GREEN}✅ Docker containers started${NC}\n"

# Step 4: Wait for services to be ready
echo -e "${YELLOW}⏳ Step 4: Waiting for services to be healthy...${NC}"
sleep 10

# Check if Redis is ready
max_attempts=30
attempt=1
until docker exec redis redis-cli ping > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ Redis failed to start${NC}"
        exit 1
    fi
    echo "  Waiting for Redis... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done
echo -e "${GREEN}✅ Redis is ready${NC}"

# Check if MongoDB is ready
attempt=1
until docker exec mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ MongoDB failed to start${NC}"
        exit 1
    fi
    echo "  Waiting for MongoDB... ($attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done
echo -e "${GREEN}✅ MongoDB is ready${NC}\n"

# Step 5: Show startup instructions
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  ✅ Setup Complete!${NC}"
echo -e "${GREEN}================================================${NC}\n"

echo -e "${BLUE}📋 Next Steps:${NC}\n"

echo -e "${YELLOW}Terminal 1 - Start Main Backend Server:${NC}"
echo -e "  ${GREEN}npm run dev${NC}"
echo -e "  Access at: http://localhost:3000"
echo -e "  WebSocket: ws://localhost:3000/ws\n"

echo -e "${YELLOW}Terminal 2 - Start Telemetry Worker:${NC}"
echo -e "  ${GREEN}npm run worker:dev${NC}"
echo -e "  Consumes from Redis Streams and writes to MongoDB\n"

echo -e "${YELLOW}Terminal 3 (Optional) - Run Test:${NC}"
echo -e "  ${GREEN}npm run test:telemetry${NC}"
echo -e "  Simulates drone telemetry data\n"

echo -e "${BLUE}🔍 Monitoring Dashboards:${NC}\n"
echo -e "  MongoDB: ${GREEN}http://localhost:8081${NC}"
echo -e "  Redis CLI: ${GREEN}docker exec -it redis redis-cli${NC}\n"

echo -e "${BLUE}📚 Documentation:${NC}\n"
echo -e "  Environment config: ${GREEN}.env${NC}\n"

echo -e "${BLUE}🛑 To stop all services:${NC}\n"
echo -e "  ${GREEN}docker-compose down${NC}\n"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Ready to start! Follow the steps above.${NC}"
echo -e "${BLUE}================================================${NC}\n"
