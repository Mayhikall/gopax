const { PrivyClient } = require("@privy-io/node");
const db = require("../../db/knex");
const config = require("../config");
const { AppError } = require("../middleware/error.middleware");

let privyClient;

function getPrivyClient() {
  if (!config.privy.appId || !config.privy.appSecret) {
    throw new AppError(
      "Privy authentication is not configured.",
      503,
      "AUTH_UNAVAILABLE",
    );
  }
  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: config.privy.appId,
      appSecret: config.privy.appSecret,
    });
  }
  return privyClient;
}

function selectIdentity(privyUser) {
  const accounts = privyUser.linked_accounts || [];
  const ethereumWallets = accounts.filter(
    (account) =>
      account.type === "wallet" &&
      account.chain_type === "ethereum" &&
      typeof account.address === "string",
  );
  const embedded = ethereumWallets.find(
    (account) =>
      account.connector_type === "embedded" ||
      account.wallet_client_type === "privy",
  );
  const google = accounts.find((account) => account.type === "google_oauth");
  const wallet = google && embedded ? embedded : ethereumWallets[0];

  if (!wallet) {
    throw new AppError(
      "Your Privy account does not have an Ethereum wallet yet.",
      409,
      "WALLET_NOT_READY",
    );
  }

  return {
    walletAddress: wallet.address.toLowerCase(),
    walletType:
      wallet.connector_type === "embedded" ||
      wallet.wallet_client_type === "privy"
        ? "embedded"
        : "external",
    authMethod: google ? "google" : "wallet",
    email: google?.email || null,
  };
}

async function findOrCreatePrivyUser(privyUser) {
  const existing = await db("users")
    .where({ privy_user_id: privyUser.id })
    .first();

  if (existing) return existing;

  const identity = selectIdentity(privyUser);
  const walletOwner = await db("users")
    .where({ wallet_address: identity.walletAddress })
    .first();

  if (walletOwner) {
    if (
      walletOwner.privy_user_id &&
      walletOwner.privy_user_id !== privyUser.id
    ) {
      throw new AppError(
        "This wallet already belongs to another Gopax account.",
        409,
        "WALLET_ALREADY_LINKED",
      );
    }

    const [linked] = await db("users")
      .where({ id: walletOwner.id })
      .update({
        privy_user_id: privyUser.id,
        auth_method: identity.authMethod,
        wallet_type: identity.walletType,
        email: identity.email,
        updated_at: db.fn.now(),
      })
      .returning("*");
    return linked;
  }

  const [created] = await db("users")
    .insert({
      privy_user_id: privyUser.id,
      wallet_address: identity.walletAddress,
      auth_method: identity.authMethod,
      wallet_type: identity.walletType,
      email: identity.email,
    })
    .returning("*");
  return created;
}

async function authenticateAccessToken(accessToken) {
  const client = getPrivyClient();
  const claims = await client.utils().auth().verifyAccessToken(accessToken);
  let user = await db("users").where({ privy_user_id: claims.user_id }).first();
  if (!user) {
    const privyUser = await client.users()._get(claims.user_id);
    user = await findOrCreatePrivyUser(privyUser);
  }

  return {
    id: user.id,
    privyUserId: claims.user_id,
    walletAddress: user.wallet_address,
  };
}

module.exports = {
  authenticateAccessToken,
  findOrCreatePrivyUser,
  selectIdentity,
};
