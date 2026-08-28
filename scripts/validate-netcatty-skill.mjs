import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skillDir = path.join(root, "skills", "netcatty-tool-cli");
const skillFile = path.join(skillDir, "SKILL.md");
const openaiYamlFile = path.join(skillDir, "agents", "openai.yaml");

const requiredReferences = [
  "exec.md",
  "sftp.md",
  "session-types.md",
  "control-commands.md",
  "errors.md",
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

if (!fs.existsSync(skillFile)) {
  fail(`missing ${path.relative(root, skillFile)}`);
} else {
  const body = read(skillFile);
  const frontmatterMatch = body.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    fail("SKILL.md missing YAML frontmatter");
  } else {
    const frontmatter = frontmatterMatch[1];
    if (!/^name:\s*netcatty-tool-cli$/m.test(frontmatter)) {
      fail("SKILL.md frontmatter name must be netcatty-tool-cli");
    } else {
      pass("frontmatter name");
    }
    if (!/^description:\s*.+/m.test(frontmatter)) {
      fail("SKILL.md frontmatter description missing");
    } else {
      pass("frontmatter description");
    }
  }

  for (const command of ["status", "env", "session", "exec", "job-start", "job-poll", "sftp list"]) {
    if (!body.includes(command)) {
      fail(`SKILL.md missing command example: ${command}`);
    } else {
      pass(`command example: ${command}`);
    }
  }

  if (!body.includes("--chat-session <chat-session-id>")) {
    fail("SKILL.md must require --chat-session");
  } else {
    pass("chat session requirement");
  }
}

for (const ref of requiredReferences) {
  const file = path.join(skillDir, "references", ref);
  if (!fs.existsSync(file)) {
    fail(`missing reference ${ref}`);
    continue;
  }
  const content = read(file).trim();
  if (content.length < 80) {
    fail(`reference too small: ${ref}`);
  } else {
    pass(`reference ${ref}`);
  }
}

if (!fs.existsSync(openaiYamlFile)) {
  fail("missing agents/openai.yaml");
} else {
  const content = read(openaiYamlFile);
  if (!content.includes("display_name:")) fail("openai.yaml missing display_name");
  if (!content.includes("$netcatty-tool-cli")) fail("openai.yaml default_prompt must mention $netcatty-tool-cli");
  pass("agents/openai.yaml");
}

if (!process.exitCode) {
  console.log("Netcatty skill validation passed.");
}
