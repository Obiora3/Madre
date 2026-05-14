import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import claudeHandler from "./api/claude.js";

function createJsonResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(payload) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    }
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      if (!chunks.length) return resolve({});

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function localApiPlugin() {
  return {
    name: "agencyflow-local-api",
    configureServer(server) {
      server.middlewares.use("/api/claude", async (req, res) => {
        try {
          req.body = await parseJsonBody(req);
          await claudeHandler(req, createJsonResponse(res));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Invalid JSON request body." }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react(), localApiPlugin()],
    server: {
      port: 5174,
      host: "0.0.0.0"
    },
    build: {
      sourcemap: false
    }
  };
});
