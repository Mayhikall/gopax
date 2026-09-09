const { createClient } = require("@supabase/supabase-js");
const config = require("../config");

/**
 * Supabase admin client singleton.
 * Uses service role key — server-side only, never expose to client.
 */
let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error(
        "Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    supabaseAdmin = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
    );
  }
  return supabaseAdmin;
}

/**
 * Upload a file buffer to Supabase Storage.
 *
 * @param {string} storagePath - e.g. "userId/tripId/randomId.jpg"
 * @param {Buffer} fileBuffer - File data
 * @param {string} contentType - MIME type
 * @returns {Promise<{ path: string }>}
 */
async function uploadFile(storagePath, fileBuffer, contentType) {
  const client = getSupabaseAdmin();
  const bucket = config.supabase.storageBucket;

  const { data, error } = await client.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return { path: data.path };
}

/**
 * Generate a signed URL for temporary access to a private file.
 *
 * @param {string} storagePath
 * @param {number} expiresInSeconds - Default 3600 (1 hour)
 * @returns {Promise<string>} signed URL
 */
async function getSignedUrl(storagePath, expiresInSeconds = 3600) {
  const client = getSupabaseAdmin();
  const bucket = config.supabase.storageBucket;

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete a file from storage.
 *
 * @param {string} storagePath
 */
async function deleteFile(storagePath) {
  const client = getSupabaseAdmin();
  const bucket = config.supabase.storageBucket;

  const { error } = await client.storage.from(bucket).remove([storagePath]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

module.exports = { getSupabaseAdmin, uploadFile, getSignedUrl, deleteFile };
