const mongoose = require("mongoose");

const FavouriteSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    location: {
        coordinates: {
            type: [Number],
            required: true
        }
    },
    name: {
        type: String,
        required: false
    },
    address: {
        type: String,
        required: false
    },
    numberOfFlight: {
        type: Number,
        required: false
    }
});

module.exports = mongoose.model("Favourite", FavouriteSchema);
