import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { minify } from "terser";

// Custom plugin to bundle Tampermonkey userscript
function bundleTampermonkeyPlugin() {
  return {
    name: "bundle-tampermonkey",
    async closeBundle() {
      const distDir = "dist";
      const tmDir = join(distDir, "tm");
      const sourceJsDir = join("public", "tm", "js");
      const sourceCssDir = join("public", "tm", "css");
      const distJsDir = join(tmDir, "js");
      const distCssDir = join(tmDir, "css");

      try {
        // Create dist/tm/js directory if it doesn't exist
        if (!existsSync(distJsDir)) {
          mkdirSync(distJsDir, { recursive: true });
        }

        // Read all JS files in order from source
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
          const filePath = join(sourceJsDir, file);
          const code = readFileSync(filePath, "utf-8");
          bundledCode += `\n// ===== ${file} =====\n${code}\n`;
        }

        // Read CSS from source directory
        const cssPath = join(sourceCssDir, "offers-camp.css");
        const css = readFileSync(cssPath, "utf-8");

        // Create bundled JS file (not .user.js)
        const bundled = `(function() {
  'use strict';
  
  // Inject CSS
  if (typeof GM_addStyle === 'function') {
    GM_addStyle(${JSON.stringify(css)});
  }
  
  // Bundled JavaScript
  ${bundledCode}
})();
`;

        // Write bundled file as regular .js
        const bundledPath = join(distJsDir, "offers-camp-bundle.js");
        writeFileSync(bundledPath, bundled, "utf-8");
        console.log(`✓ Created bundle: ${bundledPath}`);

        // Minify the bundle
        console.log(`🔧 Minifying bundle...`);
        const minified = await minify(bundled, {
          compress: {
            drop_console: false, // Keep console for debugging
            dead_code: true,
            pure_funcs: [],
          },
          mangle: true,
          format: {
            comments: false, // Remove comments to save space
          },
        });

        if (minified.code) {
          writeFileSync(bundledPath, minified.code, "utf-8");
          const originalSize = (bundled.length / 1024).toFixed(2);
          const minifiedSize = (minified.code.length / 1024).toFixed(2);
          const savings = ((1 - minified.code.length / bundled.length) * 100).toFixed(1);
          console.log(`✓ Minified: ${originalSize} KB → ${minifiedSize} KB (saved ${savings}%)`);
        }

        // Update the shell userscript in public/tm
        const userscriptPath = join("public", "tm", "offers-camp.user.js");
        let userscript = readFileSync(userscriptPath, "utf-8");

        // Replace all @require lines with single bundle require
        userscript = userscript.replace(
          /(\/\/ @require\s+https:\/\/tm\.offers\.camp\/js\/.*\n)+/g,
          '// @require      https://tm.offers.camp/js/offers-camp-bundle.js?v=0.01\n'
        );

        // Remove @resource line since CSS is now in bundle
        userscript = userscript.replace(
          /\/\/ @resource\s+.*\n/g,
          ''
        );

        // Remove @grant GM_getResourceText since we don't use @resource anymore
        userscript = userscript.replace(
          /\/\/ @grant\s+GM_getResourceText\n/g,
          ''
        );

        // Replace the shell body - everything is in the bundle now
        userscript = userscript.replace(
          /\(function \(\) \{[\s\S]*?\}\)\(\);/,
          '// All functionality is loaded via @require above'
        );

        writeFileSync(userscriptPath, userscript, "utf-8");
        console.log(`✓ Updated shell: ${userscriptPath}`);

        // Clean up: remove source JS and CSS files from dist, keep only bundle
        console.log(`\n🧹 Cleaning up dist directory...`);

        // Remove individual JS files
        for (const file of jsFiles) {
          const distFilePath = join(distJsDir, file);
          if (existsSync(distFilePath)) {
            rmSync(distFilePath);
            console.log(`  ✓ Removed: ${distFilePath}`);
          }
        }

        // Remove the old entry file (not needed in bundle)
        const oldEntryFile = join(distJsDir, "offers-camp.js");
        if (existsSync(oldEntryFile)) {
          rmSync(oldEntryFile);
          console.log(`  ✓ Removed: ${oldEntryFile}`);
        }

        // Remove providers directory
        const providersDir = join(distJsDir, "providers");
        if (existsSync(providersDir)) {
          rmSync(providersDir, { recursive: true });
          console.log(`  ✓ Removed: ${providersDir}`);
        }

        // Remove CSS directory entirely
        if (existsSync(distCssDir)) {
          rmSync(distCssDir, { recursive: true });
          console.log(`  ✓ Removed: ${distCssDir}`);
        }

        console.log(`✅ Cleanup complete! Dist contains only bundle and shell.\n`);

      } catch (err) {
        console.error("Error bundling userscript:", err);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleTampermonkeyPlugin()],
  server: {
    port: 5173
  }
});
