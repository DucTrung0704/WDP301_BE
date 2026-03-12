# 🧪 Tier 1 Testing Guide

**Date**: March 12, 2026  
**Goal**: Verify all Tier 1 changes are working correctly  
**Time**: ~30 minutes

---

## ✅ **Checklist: Changes Applied**

- [x] `telemetryRedisWorker.js` - Added sampling + aggressive trimming
- [x] `inflightDetection.service.js` - Uses Redis cache instead of DB queries
- [x] `.env.example` - Updated with Tier 1 config comments
- [ ] Your `.env` file - Copy settings from `.env.example`

---

## 📋 **Step 1: Copy Environment Config**

```bash
# Copy .env.example to .env if not exists
cp .env.example .env

# Make sure these are set in your .env:
TELEMETRY_SAMPLING_ENABLED=true
TELEMETRY_SAMPLING_RATIO=10
TELEMETRY_MIN_INTERVAL=1000
TELEMETRY_TTL_DAYS=7

BATCH_SIZE=1000
FLUSH_INTERVAL_MS=5000

REDIS_HOST=localhost
REDIS_PORT=6379
MONGODB_URI=mongodb://localhost:27017/utm
```

---

## 🚀 **Step 2: Start Services**

### Terminal 1: Start Redis
```bash
docker-compose up -d redis
# Expected output: redis created successfully
```

### Terminal 2: Start MongoDB
```bash
docker-compose up -d mongodb
# Expected output: mongodb created successfully
```

### Terminal 3: Start the Backend
```bash
npm run dev
# Expected output:
# ✅ Server running on port 3000
# ✅ Socket.IO initialized on /ws
```

### Terminal 4: Start the Worker
```bash
npm run worker:dev
# Expected outputs:
# ✅ MongoDB connected
# ✅ Redis connected
# ✅ Redis Streams consumer group initialized
# ✅ Telemetry consumer started (ID: telemetry-worker-12345)
```

---

## 🧪 **Test 1: Verify Redis Stream Sampling (No Data Loss)**

### Test Setup
```bash
# Terminal 5: Monitor Redis Stream length
watch -n 1 'redis-cli XLEN telemetry:stream'

# Expected: Shows stream length every 1 second
# Should stay ~10k-20k (bounded by trimming)
```

### Trigger Telemetry
Send WebSocket telemetry from a drone (or use test script):

```bash
# If you have a test script:
npm run test:telemetry

# OR manually send via WebSocket:
# Connect to ws://localhost:3000/ws with JWT token
# Send: { event: "telemetry", data: { droneId: "d1", lat: 10.5, lng: 20.3, alt: 100, speed: 5, ... } }
```

### Expected Results
```bash
# Watch output 1: Stream length stays bounded
XLEN telemetry:stream
  → 15234  (stays around 10k-20k)
  → 14982  (trimmed to 10k, stays stable)
  → 16745  (grows as new data comes in)
  → 15125  (trimmed back down)  ← GOOD! ✅

# Worker logs should show messages being received
# ✅ Batch: 456/1000 in 45ms | Total: 2500/50000 | Sampled: 95%
```

---

## 🧪 **Test 2: Verify Sampling is Working**

### Expected in Worker Logs
```
✅ Batch: 100/100 in 45ms | Total: 500/5000 | Sampled: 90%
^         ^   ^             ^      ^   ^      ^
          |   |             |      |   |      |
          actual inserted   total batches received
                                              sampling rate
```

### Interpretation
- **Received**: 5000 messages came from Redis Stream
- **Inserted**: 500 went to MongoDB (only 10%)
- **Sampled**: 4500 discarded (90%) ← This is the optimization! ✅

### If Sampling NOT Working
If you see `Sampled: 0%`, then:
```bash
# Check env var:
echo $TELEMETRY_SAMPLING_RATIO  # Should print 10

# If not set, add to .env:
TELEMETRY_SAMPLING_ENABLED=true
TELEMETRY_SAMPLING_RATIO=10

# Restart worker:
npm run worker:dev
```

---

## 🧪 **Test 3: Verify Stream Trimming (Memory Bounded)**

### Monitor Redis Memory
```bash
# Terminal: Watch Redis memory usage
watch -n 2 'redis-cli INFO memory | grep used_memory_human'

# Expected:
# used_memory_human:12.5M  (stable, bounded)
# NOT growing continuously like before
```

### Check for Trim Logs
Worker should log every 5 seconds:
```
📊 Stream size: 18234 → trimming to 20000
📊 Stream size: 12456 → trimming to 20000
...
```

If you DON'T see regular trimming every 5-10 seconds, something's wrong.

---

## 🧪 **Test 4: Verify Conflict Detection Speed**

### Before Changes
- Latency: 50-100ms per telemetry point
- Because: Each point queries DB for other drones

### After Changes
- Latency: 0.5-5ms per telemetry point
- Because: Uses Redis cache (instant)

### How to Measure
Add timing to logs temporarily:

```javascript
// In inflightDetection.service.js, add at start of runInflightChecks:
const startTime = Date.now();

// ... rest of function ...

// At end, add:
const duration = Date.now() - startTime;
if (duration > 10) {  // Log slow checks
  console.log(`⚠️ Conflict check took ${duration}ms`);
} else {
  console.log(`✅ Conflict check ${duration}ms`);
}
```

Expected: Most logs show `✅ Conflict check 1-5ms`

---

## 🧪 **Test 5: Database Size Growth (Should be Stable)**

### Before Tier 1
```bash
# Database grows quickly
db.telemetries.stats()
  → dataSize: 50MB after 1 hour (!)
  → dataSize: 100MB after 2 hours (!)
  → Grows 50MB/hour
```

### After Tier 1
```bash
# Database grows slowly due to sampling
db.telemetries.stats()
  → dataSize: 5MB after 1 hour
  → dataSize: 10MB after 2 hours
  → Grows 5MB/hour (90% reduction!)
```

### Monitor Growth
```bash
# Start monitoring:
while true; do
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $(mongo utm --eval 'db.telemetries.stats().dataSize' 2>/dev/null | tail -1) bytes"
  sleep 60
done

# Expected: Linear growth ~5MB/hour (not accelerating)
```

---

## 🚨 **Troubleshooting**

### Problem: No messages appearing in MongoDB
```
✅ Batch: 0/0 in 0ms | Total: 0/0 | Sampled: 0%
```

**Diagnosis:**
1. Is WebSocket receiving telemetry?
   ```bash
   # Check logs for: "Socket client connected"
   # Check logs for: "✅ Telemetry ack sent"
   ```

2. Is Redis Stream getting data?
   ```bash
   redis-cli XLEN telemetry:stream
   # Should be > 0
   ```

3. Is Worker reading from stream?
   ```bash
   # Check logs for: "✅ Telemetry consumer started"
   ```

### Problem: Database queries in conflict detection still executing
**Sign**: See logs like `Query latency: 50-100ms`

**Fix:**
1. Verify `cacheOps.getAllDroneLocations()` is being called
2. Check Redis cache has data:
   ```bash
   redis-cli KEYS "drone:*:location"
   # Should show drone location keys
   ```

3. Restart worker to pick up Redis cache

### Problem: Redis Stream keeps growing (trimming not working)
**Sign**: `redis-cli XLEN telemetry:stream` keeps increasing

**Fix:**
1. Worker trimming interval may not be running. Check logs for:
   ```
   📊 Stream size: ... → trimming
   ```

2. If missing, worker may have crashed. Check errors and restart:
   ```bash
   npm run worker:dev
   ```

---

## ✅ **Success Criteria**

Once Tier 1 is working, you should see:

| Metric | Expected | How to Verify |
|--------|----------|---------------|
| **Sampling Rate** | 90%+ | Worker logs show "Sampled: 90%" |
| **Stream Size** | 10k-20k | `redis-cli XLEN` bounded |
| **Conflict Latency** | <5ms | Logs show "Conflict check 1-5ms" |
| **DB Growth** | ~5MB/hour | Database size stable |
| **Trimming** | Every 5s | Logs show periodic trim messages |

---

## 📊 **Performance Numbers**

Once working, measure these:

```bash
# 1. Peak throughput (records/second)
# Look for: "✅ Batch: X/1000 in Yms"
# Calculate: (1000 records / Y milliseconds) * 1000 = records/sec
# Expected: 10,000+ records/sec

# 2. Insertion time
# Look for: "Batch: X/1000 in Yms"
# Expected: 40-100ms for 1000 records

# 3. Conflict check latency
# Look for: "Conflict check Xms"
# Expected: 1-10ms per check

# 4. Consumer lag
# run: redis-cli XINFO GROUPS telemetry:stream
# Look for: "pending_count"
# Expected: 0 or very small number
```

---

## 🎉 **You're Done!**

If all tests pass, Tier 1 is successful! 🚀

### Next Steps (Tier 2):
- Run multiple worker instances for 100+ drones
- Add parallel processing
- Monitor consumer lag

---

**Questions?** Check the logs and compare with expected outputs above!
