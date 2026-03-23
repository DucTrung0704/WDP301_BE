const { SePayPgClient } = require("sepay-pg-node")

const SepayClient = new SePayPgClient({
    env: "production",
    merchant_id: process.env.MERCHANT_ID,
    secret_key: process.env.SEPAY_SECRET_KEY
})

module.exports = SepayClient;

