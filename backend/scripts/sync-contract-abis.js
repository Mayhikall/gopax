const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const contractsDirectory = path.resolve(__dirname, "../../contracts");
execFileSync("forge", ["build", "--offline"], {
  cwd: contractsDirectory,
  stdio: "inherit",
});
for (const contractName of ["GopaxToken", "RewardManager"]) {
  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(
        contractsDirectory,
        "out",
        `${contractName}.sol`,
        `${contractName}.json`,
      ),
      "utf8",
    ),
  );
  if (!Array.isArray(artifact.abi))
    throw new Error(`Missing ABI: ${contractName}`);
  fs.writeFileSync(
    path.resolve(__dirname, "../src/abi", `${contractName}.json`),
    JSON.stringify(artifact.abi, null, 2) + "\n",
  );
  console.log(`Synced ${contractName} ABI from compiled artifact.`);
}
