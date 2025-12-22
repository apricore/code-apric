const path = require("path");
const esbuild = require("esbuild");

const isWatch = process.argv.includes('--watch');

const buildConfig = {
  entryPoints: [path.join(__dirname, "./src/client")],
  bundle: true,
  format: 'esm',
  outfile: path.join(__dirname, "./public/admin/index.js"),
  minify: true,
  platform: 'browser',
  external: [],
};

if (isWatch) {
  esbuild.context(buildConfig).then((ctx) => {
    ctx.watch();
    console.log('Watching for changes...');
  }).catch((err) => {
    console.error('Watch failed:', err);
    process.exit(1);
  });
} else {
  esbuild.build(buildConfig)
    .then(() => {
      console.log('Build complete!');
    })
    .catch((err) => {
      console.error('Build failed:', err);
      process.exit(1);
    });
}