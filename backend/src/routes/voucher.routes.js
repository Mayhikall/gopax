const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const voucherController = require("../controllers/voucher.controller");

const router = express.Router();

// Public: Browse voucher catalog
router.get("/", voucherController.getVouchers);

// Protected: Get user's redeemed vouchers
router.get("/my-vouchers", authenticate, voucherController.getMyVouchers);

// Protected: Redeem a voucher with txHash
router.post("/redeem", authenticate, voucherController.redeemVoucher);

module.exports = router;
