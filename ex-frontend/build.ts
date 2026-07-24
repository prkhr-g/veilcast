#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

const appRoot = import.meta.dir;

const toCamelCase = (str: string): string => str.replace(/-([a-z])/g, group => group[1]?.toUpperCase() ?? "");

const parseValue = (value: string): unknown => {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return Number.parseFloat(value);
  if (value.includes(",")) return value.split(",").map(item => item.trim());
  return value;
};

function parseArgs(): Partial<Bun.BuildConfig> {
  const config: Record<string, unknown> = {};
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;

    if (arg.startsWith("--no-")) {
      config[toCamelCase(arg.slice(5))] = false;
      continue;
    }

    if (!arg.includes("=") && (index === args.length - 1 || args[index + 1]?.startsWith("--"))) {
      config[toCamelCase(arg.slice(2))] = true;
      continue;
    }

    let key: string;
    let value: string;
    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2) as [string, string];
    } else {
      key = arg.slice(2);
      value = args[++index] ?? "";
    }

    config[toCamelCase(key)] = parseValue(value);
  }

  return config as Partial<Bun.BuildConfig>;
}

const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const cliConfig = parseArgs();
const outdir = path.resolve(process.cwd(), String(cliConfig.outdir ?? "dist/ex-frontend"));

if (existsSync(outdir)) await rm(outdir, { recursive: true, force: true });

const srcDir = path.join(appRoot, "src");
const entrypoints = [...new Bun.Glob("**/*.html").scanSync(srcDir)].map(file => path.join(srcDir, file));

const start = performance.now();
const result = await Bun.build({
  ...cliConfig,
  entrypoints,
  outdir,
  plugins: [plugin],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

console.table(
  result.outputs.map(output => ({
    File: path.relative(process.cwd(), output.path),
    Type: output.kind,
    Size: formatFileSize(output.size),
  })),
);
console.log(`Build completed in ${(performance.now() - start).toFixed(2)}ms`);
