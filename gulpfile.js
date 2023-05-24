const { series, src, dest } = require("gulp");
const concat = require("gulp-concat");
const terser = require("gulp-terser");
const rename = require("gulp-rename");

const obfuscator = require("./src/obfuscator.js");

function concatScripts() {
  return src(["src/simpleFingerprintCollector.js", "src/fingerprint/*.js"])
    .pipe(concat("simpleFingerprintCollector.js"))
    .pipe(dest("./dist/"));
}

exports.concat = concatScripts;

function obfuscateFPScript(done) {
  obfuscator.obfuscate(
    "./dist/simpleFingerprintCollector.js",
    "./dist/obfuscated.js",
  );
  done();
}

exports.obfuscate = obfuscateFPScript;

function compress() {
  return src("dist/obfuscated.js")
    .pipe(
      terser({
        compress: {
          booleans: false,
          drop_console: true,
          evaluate: false,
          keep_classnames: false,
        },
        mangle: {
          toplevel: true,
          reserved: ["fingerprintCollector", "collect"],
        },
        keep_fnames: false,
        output: {
          beautify: false,
        },
      }),
    )
    .pipe(rename({ extname: ".min.js" }))

    .pipe(dest("dist/"));
}

exports.compress = compress;

exports.build = series(concatScripts, obfuscateFPScript, compress);