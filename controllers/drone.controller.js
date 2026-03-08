const Drone = require("../models/drone.model");

exports.createDrone = async (req, res) => {
    try {
        const {
            serialNumber,
            model,
            ownerType,
            maxAltitude,
        } = req.body;

        // Validate required fields
        if (!serialNumber) {
            return res.status(400).json({ message: "serialNumber is required" });
        }

        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        // Create drone with auto-generated droneId
        const drone = await Drone.create({
            serialNumber,
            model,
            owner: req.user.id,
            ownerType: ownerType || "INDIVIDUAL",
            maxAltitude,
        });

        // Populate owner data before sending response
        await drone.populate("owner", "email profile.fullName role");

        res.status(201).json(drone);
    } catch (err) {
        console.error("Create drone error:", err);
        res.status(500).json({
            message: "Create drone failed",
            error: err.message
        });
    }
};

//GET all drones of current user
exports.getAllDrones = async (req, res) => {
    try {
        // Get only drones owned by current user
        const drones = await Drone.find({ owner: req.user.id }).populate(
            "owner",
            "email profile.fullName role"
        );
        res.json(drones);
    } catch (err) {
        res.status(500).json({ message: "Get drones failed" });
    }
};

//Get drone by ID
exports.getDroneById = async (req, res) => {
    try {
        const drone = await Drone.findById(req.params.id).populate(
            "owner",
            "email profile.fullName role"
        );

        if (!drone) {
            return res.status(404).json({ message: "Drone not found" });
        }

        // Check if user is the owner
        if (drone.owner._id.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Unauthorized: You don't own this drone" });
        }

        res.json(drone);
    } catch (err) {
        res.status(500).json({ message: "Get drone failed" });
    }
};


//UPDATE drone by ID
exports.updateDrone = async (req, res) => {
    try {
        // Fetch drone first to check ownership
        const drone = await Drone.findById(req.params.id);

        if (!drone) {
            return res.status(404).json({ message: "Drone not found" });
        }

        // Check if user is the owner
        if (drone.owner.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Unauthorized: You don't own this drone" });
        }

        // Prevent changing owner
        const { owner, ...updateData } = req.body;

        const updatedDrone = await Drone.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).populate("owner", "email profile.fullName role");

        res.json(updatedDrone);
    } catch (err) {
        res.status(500).json({ message: "Update drone failed" });
    }
};


//DELETE drone by ID
exports.deleteDrone = async (req, res) => {
    try {
        const drone = await Drone.findById(req.params.id);

        if (!drone) {
            return res.status(404).json({ message: "Drone not found" });
        }

        // Check if user is the owner
        if (drone.owner.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: "Unauthorized: You don't own this drone" });
        }

        await Drone.findByIdAndDelete(req.params.id);

        res.json({ message: "Drone deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Delete drone failed" });
    }
};
