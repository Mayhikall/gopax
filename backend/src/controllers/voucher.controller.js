const voucherService = require("../services/voucher.service");

/**
 * GET /vouchers
 * List available vouchers in the catalog.
 */
async function getVouchers(_req, res, next) {
  try {
    const vouchers = await voucherService.listVouchers();
    res.json({ vouchers });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /vouchers/my-vouchers
 * List vouchers redeemed by the authenticated user.
 */
async function getMyVouchers(req, res, next) {
  try {
    const redemptions = await voucherService.getUserRedemptions(req.user.id);
    res.json({ redemptions });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /vouchers/redeem
 * Submit on-chain redemption proof to receive voucher code.
 */
async function redeemVoucher(req, res, next) {
  try {
    const { voucherId, txHash } = req.body;
    const redemption = await voucherService.redeemVoucher({
      userId: req.user.id,
      walletAddress: req.user.walletAddress,
      voucherId,
      txHash,
    });
    res.status(201).json({ success: true, redemption });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getVouchers,
  getMyVouchers,
  redeemVoucher,
};
