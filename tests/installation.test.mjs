import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = "https://github.com/ngthluu/my-ba-skills";
const runtimeFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "scripts/requirements.mjs",
  "references/integrity.md",
  "references/review.md",
  "references/example.md",
];

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 60000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout.trim();
}

test("four agent manifests discover the explicitly invoked requirements skill", () => {
  for (const folder of [".claude-plugin", ".codex-plugin", ".cursor-plugin"]) {
    const metadata = JSON.parse(readFileSync(join(root, folder, "plugin.json")));
    assert.equal(metadata.name, "my-ba-skills");
    assert.equal(metadata.skills, "./skills/");
  }
  const opencode = JSON.parse(readFileSync(join(root, "opencode.json")));
  assert.deepEqual(opencode.skills.paths, ["./skills"]);
  const skill = readFileSync(join(root, "skills/requirements/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: requirements\n/m);
  assert.match(skill, /disable-model-invocation:\s*true/);
  assert.match(skill, /opencode\/autoinvoke:\s*["']?false["']?/);
  const codex = readFileSync(join(root, "skills/requirements/agents/openai.yaml"), "utf8");
  assert.match(codex, /allow_implicit_invocation:\s*false/);
  assert.match(codex, /\$requirements\b/);
  for (const file of runtimeFiles) {
    assert.ok(existsSync(join(root, "skills/requirements", file)), file);
  }
});

test("published installer carries every runtime file to all four agents", () => {
  const cli = join(root, "node_modules/skills/bin/cli.mjs");
  assert.ok(existsSync(cli), "run npm ci before installation tests");
  const temporary = mkdtempSync(join(tmpdir(), "requirements-install-"));
  try {
    const repo = join(temporary, "source");
    mkdirSync(repo);
    mkdirSync(join(repo, "skills"));
    cpSync(join(root, "skills/requirements"), join(repo, "skills/requirements"), {
      recursive: true,
    });
    run("git", ["init", "-b", "main"], repo);
    run("git", ["config", "user.name", "Installation fixture"], repo);
    run("git", ["config", "user.email", "fixture@example.invalid"], repo);
    run("git", ["add", "."], repo);
    run("git", ["commit", "-m", "fixture"], repo);
    run("git", ["tag", "v0.1.0"], repo);
    const env = {
      ...process.env,
      DISABLE_TELEMETRY: "1",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.file://${repo}.insteadOf`,
      GIT_CONFIG_VALUE_0: `${source}.git`,
      GIT_ALLOW_PROTOCOL: "file",
      GIT_TERMINAL_PROMPT: "0",
    };
    for (const agent of ["claude-code", "codex", "cursor", "opencode"]) {
      const project = join(temporary, agent);
      mkdirSync(project);
      run(
        process.execPath,
        [
          cli,
          "add",
          `${source}/tree/v0.1.0`,
          "--skill",
          "requirements",
          "--agent",
          agent,
          "--copy",
          "-y",
        ],
        project,
        env,
      );
      const installed = join(
        project,
        agent === "claude-code" ? ".claude/skills/requirements" : ".agents/skills/requirements",
      );
      for (const file of runtimeFiles) {
        assert.deepEqual(
          readFileSync(join(installed, file)),
          readFileSync(join(root, "skills/requirements", file)),
          `${agent}: ${file}`,
        );
      }
      const compareTree = (relative = "") => {
        const sourceDir = join(root, "skills/requirements", relative);
        const installedDir = join(installed, relative);
        const entries = readdirSync(sourceDir, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          const path = join(relative, entry.name);
          if (entry.isDirectory()) compareTree(path);
          else assert.deepEqual(
            readFileSync(join(installedDir, entry.name)),
            readFileSync(join(sourceDir, entry.name)),
            `${agent}: ${path}`,
          );
        }
      };
      compareTree();
      const lock = JSON.parse(readFileSync(join(project, "skills-lock.json")));
      assert.equal(lock.skills.requirements.ref, "v0.1.0");
      assert.equal(lock.skills.requirements.source, "ngthluu/my-ba-skills");
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
