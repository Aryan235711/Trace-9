const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getNumericAudit(lhr, id) {
  const audit = lhr.audits?.[id];
  return typeof audit?.numericValue === "number" ? audit.numericValue : null;
}

function scorePct(category) {
  const s = category?.score;
  return typeof s === "number" ? Math.round(s * 100) : null;
}

function fmtMs(ms) {
  if (ms == null) return "-";
  return (ms / 1000).toFixed(2) + "s";
}

function fmtNum(n, digits = 0) {
  if (n == null) return "-";
  return n.toFixed(digits);
}

function getTopOpportunities(lhr, limit = 5) {
  const audits = Object.values(lhr.audits ?? {});
  const opps = audits
    .filter((a) => a && a.details && a.details.type === "opportunity")
    .map((a) => ({
      id: a.id,
      title: a.title,
      savingsMs: typeof a.details.overallSavingsMs === "number" ? a.details.overallSavingsMs : 0,
      savingsBytes: typeof a.details.overallSavingsBytes === "number" ? a.details.overallSavingsBytes : 0,
    }))
    .filter((o) => o.savingsMs > 0 || o.savingsBytes > 0)
    .sort((a, b) => (b.savingsMs - a.savingsMs) || (b.savingsBytes - a.savingsBytes));

  return opps.slice(0, limit);
}

function main() {
  const root = process.cwd();
  const dir = path.join(root, "tmp", "lighthouse");
  if (!fs.existsSync(dir)) {
    console.error("Missing tmp/lighthouse directory:", dir);
    process.exit(1);
  }

  const cliFiles = process.argv.slice(2).filter(Boolean);
  const files = (cliFiles.length
    ? cliFiles.map((f) => path.basename(f))
    : fs.readdirSync(dir).filter((f) => f.endsWith(".report.json"))
  ).sort();

  if (files.length === 0) {
    console.error("No Lighthouse report JSON files found.");
    process.exit(1);
  }

  for (const file of files) {
    const full = path.join(dir, file);
    const lhr = readJson(full);

    const perf = scorePct(lhr.categories?.performance);
    const a11y = scorePct(lhr.categories?.accessibility);
    const bp = scorePct(lhr.categories?.["best-practices"]);
    const seo = scorePct(lhr.categories?.seo);

    const lcp = getNumericAudit(lhr, "largest-contentful-paint");
    const tbt = getNumericAudit(lhr, "total-blocking-time");
    const cls = getNumericAudit(lhr, "cumulative-layout-shift");
    const si = getNumericAudit(lhr, "speed-index");
    const tti = getNumericAudit(lhr, "interactive");

    console.log("\n" + file);
    console.log(`  Scores: perf ${perf ?? "-"} | a11y ${a11y ?? "-"} | bp ${bp ?? "-"} | seo ${seo ?? "-"}`);
    console.log(`  LCP ${fmtMs(lcp)} | TBT ${fmtNum(tbt)}ms | CLS ${cls == null ? "-" : fmtNum(cls, 3)} | SI ${fmtMs(si)} | TTI ${fmtMs(tti)}`);

    const opps = getTopOpportunities(lhr, 5);
    if (opps.length) {
      console.log("  Top opportunities:");
      for (const o of opps) {
        const ms = o.savingsMs ? Math.round(o.savingsMs) + "ms" : "-";
        const kb = o.savingsBytes ? Math.round(o.savingsBytes / 1024) + "KB" : "-";
        console.log(`    - ${o.title} (${ms}, ${kb})`);
      }
    }
  }
}

main();
