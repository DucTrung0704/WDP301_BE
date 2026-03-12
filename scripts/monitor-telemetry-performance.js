/**
 * Telemetry Performance Monitoring Script
 * 
 * Track real-time database performance metrics
 * Usage: node scripts/monitor-telemetry-performance.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Telemetry = require('../src/modules/telemetry/telemetry.model');
const FlightSession = require('../src/modules/flightSession/flightSession.model');

// Configuration
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/utm';
const SAMPLE_SIZE = 1000; // Sample last N records
const CHECK_INTERVAL = 10000; // Check every 10 seconds

class TelemetryMonitor {
    constructor() {
        this.metrics = {
            totalRecords: 0,
            collectionSize: 0,
            avgDocSize: 0,
            writeRate: 0,
            queriesPerSecond: 0,
            indexStats: {},
        };
        this.lastCount = 0;
        this.startTime = Date.now();
    }

    async connect() {
        try {
            await mongoose.connect(MONGO_URI, {
                serverSelectionTimeoutMS: 5000,
            });
            console.log('✅ Connected to MongoDB');
        } catch (err) {
            console.error('❌ MongoDB connection error:', err.message);
            process.exit(1);
        }
    }

    async getMetrics() {
        try {
            // Get collection statistics
            const stats = await Telemetry.collection.stats();

            // Get record count
            const totalRecords = await Telemetry.countDocuments();

            // Get sampled vs full records
            const sampledCount = await Telemetry.countDocuments({ isSampled: false });
            const unsampledCount = totalRecords - sampledCount;

            // Get database size
            const collectionSize = stats.size / (1024 * 1024); // MB

            // Calculate average document size
            const avgDocSize = stats.avgObjSize || 0;

            // Get write rate (records added in last interval)
            const newRecords = totalRecords - this.lastCount;
            const writeRate = newRecords / (CHECK_INTERVAL / 1000);

            // Get active sessions
            const activeSessions = await FlightSession.countDocuments({
                status: 'IN_PROGRESS'
            });

            // Index statistics
            const indexes = await Telemetry.collection.getIndexes();

            // Update metrics
            this.metrics = {
                totalRecords,
                sampledRecords: sampledCount,
                unsampledRecords: unsampledCount,
                samplingRate: ((unsampledCount / totalRecords) * 100).toFixed(2),
                collectionSize: collectionSize.toFixed(2),
                avgDocSize: avgDocSize.toFixed(0),
                writeRate: writeRate.toFixed(2),
                activeSessions,
                indexCount: Object.keys(indexes).length,
            };

            this.lastCount = totalRecords;
            return this.metrics;
        } catch (err) {
            console.error('❌ Error fetching metrics:', err.message);
            return null;
        }
    }

    async estimateProjectedSize() {
        try {
            // Get oldest and newest records
            const oldest = await Telemetry.findOne().sort({ timestamp: 1 }).lean();
            const newest = await Telemetry.findOne().sort({ timestamp: -1 }).lean();

            if (!oldest || !newest) return null;

            const ageMs = newest.timestamp - oldest.timestamp;
            const ageHours = ageMs / (1000 * 60 * 60);
            const recordsPerHour = this.metrics.totalRecords / Math.max(1, ageHours);

            // Project one month worth
            const projectedMonthly = recordsPerHour * 24 * 30;
            const projectedSizeMb = (projectedMonthly * (this.metrics.avgDocSize / 1024)) / 1024;

            return {
                ageHours: ageHours.toFixed(1),
                recordsPerHour: recordsPerHour.toFixed(0),
                projectedMonthlyRecords: projectedMonthly.toFixed(0),
                projectedMonthlySizeMb: projectedSizeMb.toFixed(2),
            };
        } catch (err) {
            return null;
        }
    }

    printMetrics() {
        console.clear();
        console.log('═══════════════════════════════════════════════════════════');
        console.log('   TELEMETRY PERFORMANCE MONITORING');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('📊 DATABASE METRICS:');
        console.log(`   Total Records: ${this.metrics.totalRecords?.toLocaleString()}`);
        console.log(`   Stored Records: ${this.metrics.sampledRecords?.toLocaleString()} (sampled)`);
        console.log(`   Sampling Rate: ${this.metrics.samplingRate}% of data stored`);
        console.log(`   Collection Size: ${this.metrics.collectionSize} MB`);
        console.log(`   Avg Document Size: ${this.metrics.avgDocSize} bytes`);

        console.log('\n⚡ PERFORMANCE METRICS:');
        console.log(`   Write Rate: ${this.metrics.writeRate} records/second`);
        console.log(`   Active Flight Sessions: ${this.metrics.activeSessions}`);
        console.log(`   Active Indexes: ${this.metrics.indexCount}`);

        // Projections
        this.estimateProjectedSize().then(projection => {
            if (projection) {
                console.log('\n📈 PROJECTED USAGE (Monthly):');
                console.log(`   Records: ${projection.projectedMonthlyRecords}`);
                console.log(`   Storage: ${projection.projectedMonthlySizeMb} MB`);
                console.log(`   Data Age Range: ${projection.ageHours} hours`);
            }
        });

        console.log('\n💡 OPTIMIZATION TIPS:');
        const samplingRate = parseFloat(this.metrics.samplingRate);

        if (samplingRate > 20) {
            console.log('   ✓ Sampling is working well (storing <20% of data)');
        } else if (samplingRate > 50) {
            console.log('   ⚠️  Consider increasing TELEMETRY_SAMPLING_RATIO');
        } else {
            console.log('   ⚠️  Sampling ratio may be too aggressive (storing <10%)');
        }

        const recordsPerSecond = parseFloat(this.metrics.writeRate);
        if (recordsPerSecond > 100) {
            console.log(`   ⚠️  High write rate (${recordsPerSecond}/sec)`);
            console.log('      Increase BATCH_SIZE or SAMPLING_RATIO');
        }

        if (this.metrics.collectionSize > 1000) {
            console.log(`   ⚠️  Large collection (${this.metrics.collectionSize} MB)`);
            console.log('      TTL may not be working. Verify indexes.');
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`Last Updated: ${new Date().toLocaleTimeString()}`);
        console.log('═══════════════════════════════════════════════════════════\n');
    }

    async start() {
        await this.connect();

        console.log('📊 Starting Telemetry Performance Monitor...\n');

        // Initial fetch
        await this.getMetrics();
        this.printMetrics();

        // Set interval for continuous monitoring
        setInterval(async () => {
            await this.getMetrics();
            this.printMetrics();
        }, CHECK_INTERVAL);
    }
}

// Start the monitor
const monitor = new TelemetryMonitor();
monitor.start().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down monitor...');
    await mongoose.connection.close();
    process.exit(0);
});
