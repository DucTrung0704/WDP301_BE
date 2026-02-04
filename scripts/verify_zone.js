const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const Zone = require("../models/zone.model");

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // 0. Cleanup previous tests
    await Zone.deleteMany({ name: /^TEST_ZONE/ });

    // ==========================================
    // TC1: Create Valid Zone
    // ==========================================
    console.log("\n--- TC1: Create Valid Zone ---");
    const validGeo = {
      type: "Polygon",
      coordinates: [
        [
          [10, 10],
          [10, 20],
          [20, 20],
          [20, 10],
          [10, 10],
        ],
      ],
    };
    let z1;
    try {
      z1 = await Zone.create({
        name: "TEST_ZONE_VALID",
        type: "restricted",
        geometry: validGeo,
        minAltitude: 0,
        maxAltitude: 100,
      });
      if (z1) console.log("PASS: Valid zone created");
    } catch (err) {
      console.error("FAIL TC1: Could not create valid zone");
      console.error("Error Message:", err.message);
      if (err.errors) {
        console.error(
          "Validation Errors:",
          JSON.stringify(err.errors, null, 2),
        );
      }
    }

    // ==========================================
    // TC2: Invalid Altitude (Min > Max)
    // ==========================================
    console.log("\n--- TC2: Invalid Altitude (Min > Max) ---");
    try {
      await Zone.create({
        name: "TEST_ZONE_BAD_ALT",
        type: "restricted",
        geometry: validGeo,
        minAltitude: 200,
        maxAltitude: 100,
      });
      console.error("FAIL: Should have rejected bad altitude");
    } catch (err) {
      console.log("PASS: Rejected bad altitude (" + err.message + ")");
    }

    // ==========================================
    // TC3: Invalid Geometry (Bowtie / Self-Intersection)
    // ==========================================
    console.log("\n--- TC3: Invalid Geometry (Self-Intersection) ---");
    const bowtieGeo = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 10],
          [0, 10],
          [10, 0],
          [0, 0],
        ],
      ],
    };
    try {
      await Zone.create({
        name: "TEST_ZONE_BOWTIE",
        type: "no_fly",
        geometry: bowtieGeo,
        maxAltitude: 100,
      });
      console.error("FAIL: Should have rejected bowtie polygon");
    } catch (err) {
      console.log("PASS: Rejected bowtie polygon (" + err.message + ")");
    }

    // ==========================================
    // TC4: Check Point Logic
    // ==========================================
    console.log("\n--- TC4: Check Point Logic ---");
    if (z1) {
      // Only run if z1 created
      const checkPoint = async (lat, lng, alt) => {
        const point = { type: "Point", coordinates: [lng, lat] };
        const potentialZones = await Zone.find({
          status: { $ne: "archived" },
          geometry: { $geoIntersects: { $geometry: point } },
        });

        return potentialZones.filter((z) => {
          if (alt < z.minAltitude || alt > z.maxAltitude) return false;
          // simple time check
          if (z.effectiveFrom && new Date() < z.effectiveFrom) return false;
          return true;
        });
      };

      // Test 1: Inside
      const hit = await checkPoint(15, 15, 50);
      if (hit.length > 0)
        console.log("PASS: Point inside (lat 15, lng 15, alt 50) found");
      else console.error("FAIL: Point inside NOT found");

      // Test 2: Too High
      const missHigh = await checkPoint(15, 15, 150);
      if (missHigh.length === 0) console.log("PASS: Too high ignored");
      else console.error("FAIL: Too high WAS found");
    } else {
      console.log("SKIPPING TC4 (Depends on TC1)");
    }

    // ==========================================
    // TC5: Soft Delete
    // ==========================================
    console.log("\n--- TC5: Soft Delete ---");
    if (z1) {
      z1.status = "archived";
      await z1.save();
      console.log("Zone archived.");
      // Re-check
      const point = { type: "Point", coordinates: [15, 15] }; // lng 15, lat 15
      const found = await Zone.find({
        status: { $ne: "archived" },
        geometry: { $geoIntersects: { $geometry: point } },
      });
      if (found.length === 0) console.log("PASS: Archived zone ignored");
      else console.error("FAIL: Archived zone WAS found");
    }

    console.log("\n✅ TESTS ENDED");
  } catch (err) {
    console.error("Global Run Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
