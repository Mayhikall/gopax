const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { uploadFile, getSupabaseAdmin } = require("../lib/supabase");
const { AppError } = require("../middleware/error.middleware");
const db = require("../../db/knex");
const config = require("../config");

// Check image signatures before sending uploaded bytes to AI or storage.
function validateProofImage(fileBuffer, mimeType) {
  const isPng =
    Buffer.isBuffer(fileBuffer) &&
    fileBuffer.length >= 8 &&
    fileBuffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg =
    Buffer.isBuffer(fileBuffer) &&
    fileBuffer.length >= 3 &&
    fileBuffer[0] === 0xff &&
    fileBuffer[1] === 0xd8 &&
    fileBuffer[2] === 0xff;
  if (!(
    (mimeType === "image/png" && isPng) ||
    (mimeType === "image/jpeg" && isJpeg)
  )) {
    throw new AppError(
      "Invalid image. Please upload a JPG or PNG image.",
      400,
      "UNSUPPORTED_FILE_TYPE",
    );
  }
}

/**
 * Compute SHA-256 hash of a file buffer.
 *
 * @param {Buffer} fileBuffer
 * @returns {string} hex hash string (64 chars)
 */
function hashProof(fileBuffer) {
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

/**
 * Check if user has already submitted a proof with the same hash.
 *
 * @param {string} userId
 * @param {string} proofHash
 * @returns {Promise<boolean>}
 */
async function isDuplicateProof(userId, proofHash) {
  const existing = await db("trip_proofs")
    .where({ user_id: userId, proof_hash: proofHash })
    .first();
  return !!existing;
}

/**
 * Determine proof type from MIME type.
 *
 * @param {string} mimeType
 * @returns {string} 'jpg' | 'png'
 */
function getProofType(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  return map[mimeType] || "unknown";
}

/**
 * Upload proof file to Supabase Storage and store metadata in DB.
 *
 * @param {Object} params
 * @param {Buffer} params.fileBuffer - File data
 * @param {string} params.mimeType - MIME type
 * @param {string} params.originalName - Original file name
 * @param {string} params.userId
 * @param {string} params.tripId
 * @returns {Promise<{ proofHash: string, storageKey: string, proofType: string }>}
 */
async function processAndStoreProof({ fileBuffer, mimeType, userId, tripId }) {
  validateProofImage(fileBuffer, mimeType);
  // 1. Hash the proof file
  const proofHash = hashProof(fileBuffer);

  // 2. Check for duplicate
  const isDuplicate = await isDuplicateProof(userId, proofHash);
  if (isDuplicate) {
    throw new AppError(
      "This proof has already been used.",
      409,
      "DUPLICATE_PROOF",
    );
  }

  // 3. Build storage path: trip-proofs/{userId}/{tripId}/{randomId}.ext
  const proofType = getProofType(mimeType);
  const fileName = `${uuidv4()}.${proofType}`;
  const storagePath = `${userId}/${tripId}/${fileName}`;

  // 4. Upload to Supabase Storage
  await uploadFile(storagePath, fileBuffer, mimeType);

  // 5. Store proof metadata in database
  const [proof] = await db("trip_proofs")
    .insert({
      trip_id: tripId,
      user_id: userId,
      proof_type: proofType,
      storage_key: storagePath,
      proof_hash: proofHash,
    })
    .returning("*");

  return {
    proofHash,
    storageKey: storagePath,
    proofType,
    proofId: proof.id,
  };
}

async function loadProofImage(tripId, userId) {
  const proof = await db("trip_proofs")
    .where({ trip_id: tripId, user_id: userId })
    .first();
  if (!proof)
    throw new AppError("Trip proof not found.", 404, "PROOF_NOT_FOUND");
  const mimeType = { jpg: "image/jpeg", png: "image/png" }[proof.proof_type];
  if (!mimeType)
    throw new AppError(
      "A JPG or PNG proof is required.",
      422,
      "UNSUPPORTED_FILE_TYPE",
    );
  const { data, error } = await getSupabaseAdmin()
    .storage.from(config.supabase.storageBucket)
    .download(proof.storage_key);
  if (error)
    throw new AppError("Unable to load trip proof.", 503, "PROOF_UNAVAILABLE");
  const fileBuffer = Buffer.from(await data.arrayBuffer());
  validateProofImage(fileBuffer, mimeType);
  if (hashProof(fileBuffer) !== proof.proof_hash) {
    throw new AppError(
      "Stored proof integrity check failed.",
      409,
      "PROOF_HASH_MISMATCH",
    );
  }
  return { fileBuffer, mimeType };
}

module.exports = {
  loadProofImage,
  validateProofImage,
  hashProof,
  isDuplicateProof,
  processAndStoreProof,
};
