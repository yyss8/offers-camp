import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { minify } from "terser";
import CleanCSS from "clean-css";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// Custom plugin to minify Tampermonkey files
function minifyTampermonkeyPlugin() {
  return {
    name: "minify-tampermonkey",
    async closeBundle() {
      const distDir = "dist";
      const tmJsDir = join(distDir, "tm", "js");
      const tmCssDir = join(distDir, "tm", "css");

      // Minify JS files
      try {
        const processJsDirectory = async (dir) => {
          const items = readdirSync(dir);
          for (const item of items) {
            const fullPath = join(dir, item);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
              await processJsDirectory(fullPath);
            } else if (item.endsWith(".js")) {
              const code = readFileSync(fullPath, "utf-8");
              const result = await minify(code, {
                compress: {
                  drop_console: false, // Keep console for debugging
                  dead_code: true,
                },
                mangle: true,
                format: {
                  comments: /^!|@|userscript/i, // Preserve userscript metadata
                },
              });

              if (result.code) {
                writeFileSync(fullPath, result.code, "utf-8");
                console.log(`✓ Minified: ${fullPath}`);
              }
            }
          }
        };

        await processJsDirectory(tmJsDir);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Error minifying JS files:", err);
        }
      }

      // Minify CSS files
      try {
        const processCssDirectory = (dir) => {
          const items = readdirSync(dir);
          for (const item of items) {
            const fullPath = join(dir, item);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
              processCssDirectory(fullPath);
            } else if (item.endsWith(".css")) {
              const code = readFileSync(fullPath, "utf-8");
              const cleanCss = new CleanCSS({
                level: 2, // Advanced optimizations
              });
              const result = cleanCss.minify(code);

              if (!result.errors.length) {
                writeFileSync(fullPath, result.styles, "utf-8");
                console.log(`✓ Minified: ${fullPath}`);
              } else {
                console.error(`Error minifying ${fullPath}:`, result.errors);
              }
            }
          }
        };

        processCssDirectory(tmCssDir);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error("Error minifying CSS files:", err);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), minifyTampermonkeyPlugin()],
  server: {
    port: 5173
  }
});
