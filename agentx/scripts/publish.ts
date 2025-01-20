/**
 * Script to publish @agentx to both npm and JSR
 * Usage: deno run -A scripts/publish.ts [major|minor|patch]
 */

import { parse } from "https://deno.land/std/flags/mod.ts";
import { join } from "https://deno.land/std/path/mod.ts";

type VersionType = "major" | "minor" | "patch";

async function bumpVersion(type: VersionType = "patch"): Promise<string> {
  // Read both package.json and deno.json
  const packageJson = JSON.parse(await Deno.readTextFile("./package.json"));
  const denoJson = JSON.parse(await Deno.readTextFile("./deno.json"));

  const currentVersion = packageJson.version;
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  let newVersion: string;
  switch (type) {
    case "major":
      newVersion = `${major + 1}.0.0`;
      break;
    case "minor":
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case "patch":
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
  }

  // Update both files
  packageJson.version = newVersion;
  denoJson.version = newVersion;

  await Deno.writeTextFile(
    "./package.json",
    JSON.stringify(packageJson, null, 2)
  );
  await Deno.writeTextFile("./deno.json", JSON.stringify(denoJson, null, 2));

  return newVersion;
}

async function runCommand(
  cmd: string[],
  options: Deno.CommandOptions = {}
): Promise<boolean> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    ...options,
  });

  const { success, code } = await command.output();
  if (!success) {
    console.error(`Command failed with exit code ${code}`);
    return false;
  }
  return true;
}

async function publishToNpm(): Promise<boolean> {
  console.log("📦 Publishing to npm...");

  // Run build first
  if (!(await runCommand(["npm", "run", "build"]))) {
    return false;
  }

  // Publish to npm
  return await runCommand(["npm", "publish", "--access", "public"]);
}

async function publishToJsr(): Promise<boolean> {
  console.log("📦 Publishing to JSR...");
  return await runCommand(["deno", "publish"]);
}

async function gitCommitAndTag(version: string): Promise<boolean> {
  const commands = [
    ["git", "add", "package.json", "deno.json"],
    ["git", "commit", "-m", `chore: bump version to ${version}`],
    ["git", "tag", `v${version}`],
    ["git", "push"],
    ["git", "push", "--tags"],
  ];

  for (const cmd of commands) {
    if (!(await runCommand(cmd))) {
      return false;
    }
  }
  return true;
}

async function main() {
  // Parse command line arguments
  const flags = parse(Deno.args);
  const versionType = (flags._[0] || "patch") as VersionType;

  if (!["major", "minor", "patch"].includes(versionType)) {
    console.error("Invalid version type. Use: major, minor, or patch");
    Deno.exit(1);
  }

  try {
    // Bump version
    const newVersion = await bumpVersion(versionType);
    console.log(`🔼 Bumping version to ${newVersion}`);

    // Git commit and tag
    if (!(await gitCommitAndTag(newVersion))) {
      throw new Error("Failed to commit and tag version");
    }

    // Publish to both registries
    const npmSuccess = await publishToNpm();
    const jsrSuccess = await publishToJsr();

    if (npmSuccess && jsrSuccess) {
      console.log(`✅ Successfully published v${newVersion} to npm and JSR`);
    } else {
      throw new Error("Failed to publish to one or more registries");
    }
  } catch (error) {
    console.error("❌ Error during publishing:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
