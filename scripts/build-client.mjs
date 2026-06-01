import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/client/main.ts"],
  bundle: true,
  format: "esm",
  outfile: "app.js",
  sourcemap: true,
  target: ["es2022"],
});
