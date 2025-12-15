const http = require("http");
const https = require("https");

function requestRaw(url, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: "GET",
        headers,
      },
      (res) => {
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, size });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const base = process.env.BASE_URL || "http://localhost:5000";
  const root = await requestRaw(base + "/", {
    headers: {
      "Accept-Encoding": "br, gzip",
    },
  });
  if (root.statusCode !== 200) {
    throw new Error(`GET / failed: ${root.statusCode}`);
  }

  console.log("/ (document)");
  console.log("Status:", root.statusCode);
  console.log("Content-Type:", root.headers["content-type"] || null);
  console.log("Content-Encoding:", root.headers["content-encoding"] || null);
  console.log("Content-Length:", root.headers["content-length"] || null);
  console.log("Bytes received:", root.size);

  // Fetch HTML via fetch (fine here); just need to locate asset path.
  const html = await (await fetch(base + "/")).text();
  const match = html.match(/\/assets\/index-[^"']+\.js/);
  if (!match) {
    throw new Error("Could not find index-*.js asset in HTML");
  }

  const assetPath = match[0];
  const assetUrl = base + assetPath;

  const res = await requestRaw(assetUrl, {
    headers: {
      "Accept-Encoding": "br, gzip",
    },
  });

  console.log("Asset:", assetPath);
  console.log("Status:", res.statusCode);
  console.log("Content-Type:", res.headers["content-type"] || null);
  console.log("Content-Encoding:", res.headers["content-encoding"] || null);
  console.log("Content-Length:", res.headers["content-length"] || null);
  console.log("Bytes received:", res.size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
