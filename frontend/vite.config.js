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

// Custom plugin to bundle Tampermonkey userscript
function bundleTampermonkeyPlugin() {
  return {
    name: "bundle-tampermonkey",
    async closeBundle() {
      const distDir = "dist";
      const tmDir = join(distDir, "tm");
      const jsDir = join(tmDir, "js");
      const cssDir = join(tmDir, "css");

      try {
        // Read the userscript header
        const userscriptPath = join(tmDir, "offers-camp.user.js");
        const userscript = readFileSync(userscriptPath, "utf-8");

        // Extract header (everything between ==UserScript== markers)
        const headerMatch = userscript.match(/(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==)/);
        if (!headerMatch) {
          console.error("Could not find userscript header");
          return;
        }

        let header = headerMatch[1];

        // Remove @require and @resource lines from header
        header = header
          .split('\n')
          .filter(line => !line.includes('@require') && !line.includes('@resource'))
          .join('\n');

        // Read all JS files in order
        const jsFiles = [
          'offers-config.js',
          'offers-utils.js',
          'offers-settings.js',
          'offers-auth.js',
          'providers/amex.js',
          'providers/citi.js',
          'providers/chase.js',
          'offers-core.js'
        ];

        let bundledCode = '';
        for (const file of jsFiles) {
          const filePath = join(jsDir, file);
          const code = readFileSync(filePath, "utf-8");
          bundledCode += `\n// ===== ${file} =====\n${code}\n`;
        }

        // Read CSS
        const cssPath = join(cssDir, "offers-camp.css");
        const css = readFileSync(cssPath, "utf-8");

        // Create bundled userscript
        const bundled = `${header}

(function() {
  'use strict';
  
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(css)};
  document.head.appendChild(style);
  
  // Bundled JavaScript
  ${bundledCode}
})();
`;

        // Write bundled file
        const bundledPath = join(tmDir, "offers-camp-bundle.user.js");
        writeFileSync(bundledPath, bundled, "utf-8");
        console.log(`✓ Created bundle: ${bundledPath}`);

      } catch (err) {
        console.error("Error bundling userscript:", err);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), minifyTampermonkeyPlugin(), bundleTampermonkeyPlugin()],
  server: {
    port: 5173
  }
});
