const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".sql": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/google-places-search") {
    await handleGooglePlacesSearch(url, response);
    return;
  }

  if (url.pathname === "/api/google-places-nearby") {
    await handleGooglePlacesNearby(url, response);
    return;
  }

  serveStatic(url.pathname, response);
});

server.listen(PORT, () => {
  console.log(`자릿냥 MVP: http://localhost:${PORT}`);
});

async function handleGooglePlacesSearch(url, response) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const query = url.searchParams.get("query")?.trim();
  const display = Math.min(Number(url.searchParams.get("display") || 5), 5);

  if (!query) {
    sendJson(response, 400, { error: "query is required" });
    return;
  }

  if (!apiKey) {
    sendJson(response, 503, {
      error: "GOOGLE_MAPS_API_KEY is required",
    });
    return;
  }

  try {
    const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.types",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "ko",
        regionCode: "KR",
        pageSize: display,
      }),
    });
    const body = await googleResponse.json();
    response.writeHead(googleResponse.status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify({ items: body.places || [] }));
  } catch {
    sendJson(response, 502, { error: "failed to call google places search" });
  }
}

async function handleGooglePlacesNearby(url, response) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const category = url.searchParams.get("category") || "all";
  const display = Math.min(Number(url.searchParams.get("display") || 8), 10);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendJson(response, 400, { error: "valid lat and lng are required" });
    return;
  }

  if (!apiKey) {
    sendJson(response, 503, {
      error: "GOOGLE_MAPS_API_KEY is required",
    });
    return;
  }

  try {
    const requestBody = {
      languageCode: "ko",
      regionCode: "KR",
      maxResultCount: display,
      locationRestriction: {
        circle: {
          center: {
            latitude: lat,
            longitude: lng,
          },
          radius: 1200,
        },
      },
    };

    const includedTypes = getGoogleIncludedTypes(category);
    if (includedTypes.length) requestBody.includedTypes = includedTypes;

    const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.types",
      },
      body: JSON.stringify(requestBody),
    });
    const body = await googleResponse.json();
    response.writeHead(googleResponse.status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify({ items: body.places || [] }));
  } catch {
    sendJson(response, 502, { error: "failed to call google places nearby search" });
  }
}

function getGoogleIncludedTypes(category) {
  if (category === "cafe") return ["cafe"];
  if (category === "food") return ["restaurant", "food"];
  if (category === "study") return ["library", "cafe"];
  return ["cafe", "restaurant"];
}

function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, decodeURIComponent(requested)));

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
