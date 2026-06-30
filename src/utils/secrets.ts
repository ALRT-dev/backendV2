import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";

/**
 * Loads secrets from the AWS Secrets Manager Agent — a client-side HTTP service that
 * caches secrets in memory and runs as a local sidecar on Lambda/ECS/EKS/EC2.
 * https://docs.aws.amazon.com/secretsmanager/latest/userguide/secrets-manager-agent.html
 *
 * The agent exposes a cached endpoint on http://localhost:2773 and authenticates each
 * request with a token written to a file on disk (default /var/run/awssmatoken).
 *
 * This runs synchronously at startup (before `config` is built) so the values flow
 * through the normal `process.env` lookups in config.ts. When the agent is not present
 * (e.g. local development) it is a no-op and the .env file is used instead.
 */

const AGENT_PORT = process.env.AWS_SECRETS_AGENT_PORT || "2773";
const TOKEN_FILE =
  process.env.AWS_SECRETS_AGENT_TOKEN_FILE || "/var/run/awssmatoken";

// Secret holding the application secrets (JSON map) or a single raw value.
const SECRET_ID =
  process.env.MAPS_API_KEY_SECRET_ID || "safety-alert-prod/api-token";

// When the secret is a plain string (not a JSON map), assign it to this env var.
const RAW_SECRET_ENV_KEY =
  process.env.MAPS_API_KEY_SECRET_ENV_KEY || "GOOGLE_MAPS_API_KEY";

interface AgentResponse {
  SecretString?: string;
}

const fetchSecretString = (token: string): string | undefined => {
  const url =
    `http://localhost:${AGENT_PORT}/secretsmanager/get` +
    `?secretId=${encodeURIComponent(SECRET_ID)}&versionStage=AWSCURRENT`;

  // curl keeps the call synchronous (Node has no sync HTTP) and mirrors the agent's
  // documented usage. It ships in the runtime image; failures are handled by the caller.
  const stdout = execFileSync(
    "curl",
    ["-sS", "-H", `X-Aws-Parameters-Secrets-Token: ${token}`, url],
    { encoding: "utf8", timeout: 5000 },
  );

  const parsed = JSON.parse(stdout) as AgentResponse;
  return parsed.SecretString;
};

let loaded = false;

/**
 * Populates `process.env` from the Secrets Manager Agent. Existing environment values
 * are never overwritten, so explicit env vars still win. Safe to call more than once.
 */
export const loadSecretsFromAgent = (): void => {
  if (loaded) return;
  loaded = true;

  // Only attempt when the agent token file is present (i.e. running on a workload with
  // the Secrets Manager Agent). Otherwise fall back to .env for local/dev.
  if (!existsSync(TOKEN_FILE)) return;

  try {
    const token = readFileSync(TOKEN_FILE, "utf8").trim();
    const secretString = fetchSecretString(token);
    if (!secretString) {
      console.warn(
        `[secrets] ${SECRET_ID} returned no SecretString; using existing env`,
      );
      return;
    }

    let applied = 0;
    let isJsonMap = false;
    try {
      const obj = JSON.parse(secretString) as unknown;
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        isJsonMap = true;
        for (const [key, value] of Object.entries(obj)) {
          if (value == null) continue;
          // Don't clobber values explicitly provided via the environment.
          if (process.env[key]) continue;
          process.env[key] = String(value);
          applied++;
        }
      }
    } catch {
      // Not JSON — fall through to the raw-string handling below.
    }

    if (!isJsonMap && !process.env[RAW_SECRET_ENV_KEY]) {
      // Plain string secret -> assign to the configured env var.
      process.env[RAW_SECRET_ENV_KEY] = secretString;
      applied++;
    }

    console.info(
      `[secrets] loaded ${applied} value(s) from ${SECRET_ID} via Secrets Manager Agent`,
    );
  } catch (err) {
    // Never crash startup because of the agent; config.ts will surface any missing
    // required vars with a clear error.
    console.warn(
      `[secrets] failed to load from Secrets Manager Agent: ${(err as Error).message}`,
    );
  }
};
