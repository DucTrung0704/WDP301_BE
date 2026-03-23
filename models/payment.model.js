const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    order_id: {
        type: String,
        required: true,
    },
    order_description: {
        type: String,
        required: true,
    },
    order_amount: {
        type: Number,
        required: true,
    },
    customer_id: {
        type: String,
        required: false,
    },
    package_id: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["PENDING", "SUCCESS", "FAILED"],
        default: "PENDING",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Payment", PaymentSchema);