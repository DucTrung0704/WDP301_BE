# Redis Telemetry Architecture Setup Guide

## Overview

This guide explains the Redis Streams-based telemetry ingestion architecture for the Drone UTM system. The system uses Redis Streams as a message queue (replacing Kafka) while maintaining Redis as the caching layer.

## Architecture

```
┌─────────── WebSocket Gateway ──────────────┐
│ Receives drone telemetry via WebSocket     │
└──────────────┬────────────────┬────────────┘
               │                │
         [Redis Cache]    [Redis Streams]
      (Latest Location)   (Message Queue)
               │                │
        ┌──────┴────────┬───────┴────────┐
        │               │                │
    [Telemetry]     [Worker]         [MongoDB]
    (1-hour TTL)    Consumer         Batch Insert
```

## System Components

### 1. Redis Server
- **Role**: Message queue + Caching layer
- **Port**: 6379 (default)
- **Persistence**: AOF (Append-Only File)
- **Memory**: Configured limit based on cluster size

### 2. WebSocket Gateway
- **File**: `src/config/websocket.js`
- **Responsibility**: 
  - Accept WebSocket telemetry from drones
  - Cache latest location in Redis (1-hour TTL)
  - Write messages to Redis Streams
  - Send immediate ACK (< 5ms)

### 3. Telemetry Worker
- **File**: `src/workers/telemetryRedisWorker.js`
- **Responsibility**:
  - Read messages from Redis Streams
  - Batch accumulation (default 1000 records or 5 seconds)
  - Bulk insert to MongoDB
  - Track statistics

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js >= 14
- 2GB free disk space

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repo-url>
cd BE

# Install dependencies
npm install
```

### Step 2: Configure Environment

```bash
# Copy example to .env
cp .env.example .env

# Edit .env if using remote services
nano .env
```

**Key Environment Variables:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Leave empty for local dev
REDIS_DB=0

MONGODB_URI=mongodb://admin:password@localhost:27017/utm

BATCH_SIZE=1000          # Records before flush
FLUSH_INTERVAL_MS=5000   # Max wait time between flushes
```

### Step 3: Start Services

```bash
# Using provided quick-start script
bash scripts/quick-start.sh

# OR manually start Docker
docker-compose up -d

# Wait for services to be healthy
docker-compose ps
```

### Step 4: Verify Connectivity

```bash
# Check Redis
docker exec redis redis-cli ping
# Expected: PONG

# Check MongoDB
docker exec mongodb mongosh --eval "db.adminCommand('ping')"
# Expected: { ok: 1 }
```

### Step 5: Start Services

**Terminal 1 - Main Server:**
```bash
npm run dev
# Server runs on http://localhost:3000
```

**Terminal 2 - Telemetry Worker:**
```bash
npm run worker:dev
# Worker starts consuming from Redis Streams
```

**Terminal 3 - Test (Optional):**
```bash
npm run test:telemetry
# Simulates 5 drones sending telemetry
```

## Redis Streams Deep Dive

### Key Concepts

1. **Stream**: Ordered log of messages
   - Key: `telemetry:stream`
   - Auto-incrementing message IDs

2. **Consumer Group**: Track group progress
   - Name: `telemetry-consumer-group`
   - Allows multiple workers to process messages

3. **Message Acknowledgment**: At-least-once delivery
   - Messages are ACKed after successful processing
   - Unacked messages can be replayed

### Stream Operations

#### Write to Stream
```javascript
const id = await streamOps.addTelemetry({
  droneId: "drone-001",
  lat: 10.8231,
  lng: 106.6297,
  alt: 100,
  speed: 15,
  heading: 90,
  batteryLevel: 85
});
// Returns message ID: "1234567890000-0"
```

#### Create Consumer Group
```javascript
await streamOps.createConsumerGroup();
// Creates group: telemetry-consumer-group
```

#### Read Messages
```javascript
const messages = await streamOps.readStream(
  "worker-1",  // Consumer ID
  10,          // Max messages to read
  1000         // Block timeout (ms)
);
```

#### Acknowledge Processing
```javascript
await streamOps.ackMessage(messageId);
// Message marked as processed
```

#### Stream Management
```javascript
// Get stream length
const len = await streamOps.getStreamLength();

// Trim old messages (keep last 100k)
await streamOps.trimStream(100000);

// Get consumer group info
const info = await streamOps.getGroupInfo();
```

## Monitoring & Debugging

### Via Redis CLI

```bash
# Enter Redis CLI
docker exec -it redis redis-cli

# Stream info
> XINFO STREAM telemetry:stream
  - length: number of messages
  - radix-tree-keys: memory structure
  - radix-tree-nodes: memory structure

# Consumer group info
> XINFO GROUPS telemetry:stream
  - name: telemetry-consumer-group
  - consumers: number of active consumers
  - pending: number of unacked messages

# Consumer info
> XINFO CONSUMERS telemetry:stream telemetry-consumer-group
  - name: worker-id
  - pending: unacked message count
  - idle: ms since last activity

# Read last 5 messages
> XREVRANGE telemetry:stream + - COUNT 5

# Manual acknowledgment
> XACK telemetry:stream telemetry-consumer-group message-id

# Clear stream (caution!)
> DEL telemetry:stream
```

### Via Logs

**Worker Logs:**
```bash
# Real-time logs
npm run worker:dev

# Check for:
# ✅ Redis connected
# ✅ Consumer group created
# ✅ Batch inserted: XXX/YYY records
```

**Server Logs:**
```bash
# Real-time logs
npm run dev

# Check for:
# ✅ Redis Streams initialized
# telemetry_ack messages
# Error messages
```

## Performance Tuning

### Optimize Batch Size

```javascript
// In .env
BATCH_SIZE=2000        # Process more at once (uses more memory)
BATCH_SIZE=500         # Process less (more database hits)
```

**Recommendation:**
- **High throughput (1000+ msg/sec)**: 2000-5000
- **Medium throughput (100-1000 msg/sec)**: 1000
- **Low throughput (<100 msg/sec)**: 500

### Optimize Flush Interval

```javascript
FLUSH_INTERVAL_MS=2000  # Flush every 2 seconds (more latency)
FLUSH_INTERVAL_MS=10000 # Flush every 10 seconds (less throughput)
```

**Recommendation:**
- **Real-time critical**: 2000ms
- **Standard**: 5000ms
- **Batch optimized**: 10000ms

### Redis Memory Management

```bash
# Check memory usage
docker exec redis redis-cli INFO memory

# Set max memory policy (if needed)
docker exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Monitor real-time stats
docker exec redis redis-cli --stat
```

### Stream Trimming

```javascript
// Automatic trimming in worker
// Keeps last 100,000 messages
// Prevents unbounded memory growth

// Manual check
docker exec redis redis-cli XLEN telemetry:stream
```

## Troubleshooting

### Problem: "Redis connection refused"

**Cause**: Redis container not running
```bash
# Check status
docker-compose ps | grep redis

# Start if stopped
docker-compose start redis

# View logs
docker-compose logs redis
```

### Problem: "Consumer group already exists"

**Solution**: This is expected on restart. The error is caught and logged as a warning.

```javascript
// See src/config/redis.js line ~240
// "⚠️ Consumer group 'telemetry-consumer-group' already exists"
```

### Problem: "Pending messages in consumer group"

**Cause**: Worker crashed before acknowledging
```bash
# View pending messages
docker exec redis redis-cli XPENDING telemetry:stream telemetry-consumer-group

# Claim pending messages
docker exec redis redis-cli XCLAIM telemetry:stream telemetry-consumer-group worker-1 0 message-id

# Clear all pending (caution!)
docker exec redis redis-cli XGROUP SETID telemetry:stream telemetry-consumer-group $
```

### Problem: "High memory usage"

**Solution**: Check stream size and trim

```bash
# Check length
docker exec redis redis-cli XLEN telemetry:stream

# Check actual memory
docker exec redis redis-cli INFO memory | grep used_memory_human

# Trim if too large
docker exec redis redis-cli XTRIM telemetry:stream MAXLEN ~ 50000
```

### Problem: "Worker not processing messages"

**Checklist:**
1. Redis connected? `docker exec redis redis-cli ping`
2. Stream has messages? `docker exec redis redis-cli XLEN telemetry:stream`
3. Worker running? Check terminal output
4. Check logs for errors

```bash
# Manually add test message
docker exec redis redis-cli XADD telemetry:stream "*" \
  droneId "test-drone" \
  lat "10.8" \
  lng "106.6" \
  alt "100"

# Check database
docker exec mongodb mongosh --eval \
  "db.telemetries.countDocuments()"
```

## Scaling Considerations

### Single Worker
- **Max throughput**: ~5,000 msg/sec
- **Max drones**: ~500 (at 10 Hz)

### Multiple Workers

Run multiple worker instances to scale:

```bash
# Terminal 2a
CONSUMER_ID=worker-1 npm run worker

# Terminal 2b
CONSUMER_ID=worker-2 npm run worker

# Terminal 2c
CONSUMER_ID=worker-3 npm run worker
```

Each worker independently processes messages from the stream. Redis handles load balancing via consumer group.

### Multiple Gateways

Run multiple server instances with load balancing:

```bash
# Terminal 1a
PORT=3000 npm run dev

# Terminal 1b
PORT=3001 npm run dev

# Use reverse proxy (nginx/haproxy) to load balance
```

All gateways write to the same Redis Streams queue.

## Production Deployment

### 1. Use cluster Redis

```bash
# Instead of single instance, use Redis Cluster
# Configure connection in .env
REDIS_HOST=redis-cluster.example.com
REDIS_PORT=6379
```

### 2. Enable persistence

```yaml
# In docker-compose.yml
redis:
  command: redis-server --appendonly yes --appendfsync everysec
  volumes:
    - redis-data:/data
```

### 3. Set memory limits

```yaml
redis:
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

### 4. Monitor metrics

- Redis memory usage
- Stream length
- Consumer group lag
- Worker batch statistics

### 5. Configure backups

```bash
# Automatic .rdb snapshots
SAVE 900 1      # Save if 1 key changed in 900s
SAVE 300 10     # Save if 10 keys changed in 300s
SAVE 60 10000   # Save if 10000 keys changed in 60s
```

## Best Practices

1. **Always handle Redis failures gracefully**
   - Retry logic is built in
   - Non-blocking writes to streams

2. **Monitor stream length**
   - Trim periodically
   - Alert if grows > 500k messages

3. **Track acknowledgments**
   - Monitor pending messages
   - Replay if worker crashes

4. **Use consumer groups for reliability**
   - Distribute load across workers
   - Track processing progress

5. **Buffer and batch strategically**
   - Balance latency vs throughput
   - Adjust BATCH_SIZE based on load

## References

- [Redis Streams Documentation](https://redis.io/topics/streams-intro)
- [Redis Admin Commands](https://redis.io/commands)
- [Redis CLI Guide](https://redis.io/topics/redis-cli)

## Support

For issues or questions:
1. Check logs: `npm run worker:dev`
2. Verify Redis: `docker exec redis redis-cli ping`
3. Check stream: `docker exec redis redis-cli XLEN telemetry:stream`
4. Review IMPLEMENTATION_SUMMARY.md for architecture details
