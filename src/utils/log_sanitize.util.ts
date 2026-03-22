import { writeFileSync } from "node:fs";

/** Reduces PII in stdout/stderr (e.g. CloudWatch, CI logs). */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "[redacted]";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain) return "[redacted]";
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Writes a one-time secret to a file (preferred) or prints it on a TTY only.
 * Avoids full secrets in aggregated logs when stdout is captured.
 *
 * @returns `"exit"` if the caller should terminate with an error (no file, non-TTY).
 */
export function emitCliSecret(
  secret: string,
  envVarName: string,
): "file" | "tty" | "exit" {
  const outPath = process.env[envVarName]?.trim();
  if (outPath) {
    writeFileSync(outPath, `${secret}\n`, { mode: 0o600 });
    console.log(
      `Secret written to ${outPath} (mode 0600). Store it in a vault and delete the file.`,
    );
    return "file";
  }
  if (process.stdout.isTTY) {
    console.log(
      "\n(Secret on the next line — interactive terminal only; do not pipe to log collectors.)\n",
    );
    process.stdout.write(`${secret}\n`);
    return "tty";
  }
  console.error(
    `Refusing to print secret to captured stdout. Set ${envVarName} to a secure file path and retry.`,
  );
  return "exit";
}
