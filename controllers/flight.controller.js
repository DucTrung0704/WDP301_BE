const Flight = require("../models/flight.model");
const Drone = require("../models/drone.model");

// Tạo bản ghi chuyến bay cho operator hiện tại
exports.createFlight = async (req, res) => {
    try {
        const { droneId, startTime, endTime, origin, destination, status, notes } = req.body;

        if (!droneId || !startTime) {
            return res.status(400).json({ message: "droneId and startTime are required" });
        }

        // Tìm drone và đảm bảo thuộc sở hữu của user hiện tại
        const drone = await Drone.findById(droneId);
        if (!drone) {
            return res.status(404).json({ message: "Drone not found" });
        }

        if (drone.owner.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Unauthorized: You don't own this drone" });
        }

        const flight = await Flight.create({
            drone: drone._id,
            operator: req.user.id,
            startTime,
            endTime,
            origin,
            destination,
            status,
            notes,
        });

        await flight.populate("drone", "droneId serialNumber model");

        res.status(201).json(flight);
    } catch (err) {
        console.error("Create flight error:", err);
        res.status(500).json({ message: "Create flight failed", error: err.message });
    }
};

// Lấy lịch sử bay của operator hiện tại (2 role ngoài UTM_ADMIN)
exports.getMyFlights = async (req, res) => {
    try {
        const flights = await Flight.find({ operator: req.user.id })
            .populate("drone", "droneId serialNumber model")
            .sort({ startTime: -1 });

        res.json(flights);
    } catch (err) {
        console.error("Get my flights error:", err);
        res.status(500).json({ message: "Get my flights failed" });
    }
};

