/** Tiny console helpers. One place to change output format for `--list` / agents. */

const useColor = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;

const wrap = (code: number) => (text: string) =>
  useColor ? `\u001b[${code}m${text}\u001b[0m` : text;

export const bold = wrap(1);
export const dim = wrap(2);
export const red = wrap(31);
export const green = wrap(32);
export const yellow = wrap(33);
export const cyan = wrap(36);

export function log(message = ""): void {
  process.stdout.write(`${message}\n`);
}

export function error(message: string): void {
  process.stderr.write(`${red("error")} ${message}\n`);
}

export function success(message: string): void {
  process.stdout.write(`${green("✓")} ${message}\n`);
}

export function info(message: string): void {
  process.stdout.write(`${dim(message)}\n`);
}

export function warn(message: string): void {
  process.stdout.write(`${yellow("!")} ${message}\n`);
}

/**
 * Machine-readable mode, used by `--list` and by agents driving the CLI.
 * Suppresses every decoration and prints plain values, one per line.
 */
export function plain(value: string): void {
  process.stdout.write(`${value}\n`);
}
