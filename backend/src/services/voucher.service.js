const knex = require("../../db/knex");
const blockchainService = require("./blockchain.service");
const { AppError } = require("../middleware/error.middleware");

/**
 * List all active vouchers with available stock.
 */
async function listVouchers() {
  return knex("vouchers")
    .where({ is_active: true })
    .where("stock", ">", 0)
    .orderBy("price", "asc");
}

/**
 * Get all vouchers redeemed by a specific user.
 */
async function getUserRedemptions(userId) {
  return knex("voucher_redemptions")
    .join("vouchers", "voucher_redemptions.voucher_id", "vouchers.id")
    .where({ "voucher_redemptions.user_id": userId })
    .select(
      "voucher_redemptions.id",
      "voucher_redemptions.voucher_id as voucherId",
      "vouchers.title as voucherTitle",
      "vouchers.description as voucherDescription",
      "vouchers.category",
      "voucher_redemptions.voucher_code as voucherCode",
      "voucher_redemptions.amount_paid as amountPaid",
      "voucher_redemptions.tx_hash as txHash",
      "voucher_redemptions.created_at as createdAt",
    )
    .orderBy("voucher_redemptions.created_at", "desc");
}

/**
 * Redeem a voucher using an on-chain payment proof.
 */
async function redeemVoucher({ userId, walletAddress, voucherId, txHash }) {
  if (!voucherId || !txHash) {
    throw new AppError(
      "Voucher ID and transaction hash are required.",
      400,
      "INVALID_INPUT",
    );
  }

  // 1. Check anti-replay: tx_hash must be unique across all redemptions
  const existingTx = await knex("voucher_redemptions")
    .where({ tx_hash: txHash.toLowerCase() })
    .first();
  if (existingTx) {
    throw new AppError(
      "This transaction hash has already been redeemed.",
      409,
      "TX_ALREADY_REDEEMED",
    );
  }

  // 2. Fetch the voucher catalog record
  const voucher = await knex("vouchers")
    .where({ id: voucherId, is_active: true })
    .first();
  if (!voucher) {
    throw new AppError("Voucher not found or inactive.", 404, "VOUCHER_NOT_FOUND");
  }

  if (voucher.stock <= 0) {
    throw new AppError("This voucher is out of stock.", 400, "OUT_OF_STOCK");
  }

  // 3. Verify on-chain redemption event in the transaction receipt
  await blockchainService.verifyVoucherRedemption({
    txHash,
    walletAddress,
    voucherId,
    expectedAmount: voucher.price,
  });

  // 4. Generate unique promo code and record redemption atomically
  const uniqueCode = `${voucher.code}-${Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase()}`;

  const [redemption] = await knex.transaction(async (trx) => {
    // Decrement stock
    await trx("vouchers")
      .where({ id: voucherId })
      .decrement("stock", 1);

    // Record redemption
    return trx("voucher_redemptions")
      .insert({
        user_id: userId,
        voucher_id: voucherId,
        voucher_code: uniqueCode,
        amount_paid: voucher.price,
        tx_hash: txHash.toLowerCase(),
      })
      .returning("*");
  });

  return {
    id: redemption.id,
    voucherId: voucher.id,
    voucherTitle: voucher.title,
    category: voucher.category,
    voucherCode: uniqueCode,
    amountPaid: voucher.price,
    txHash: redemption.tx_hash,
    createdAt: redemption.created_at,
  };
}

module.exports = {
  listVouchers,
  getUserRedemptions,
  redeemVoucher,
};
