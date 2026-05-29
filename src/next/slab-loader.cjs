module.exports = function shaderlabSlabLoader(source) {
  const callback = this.async();
  const filename = this.resourcePath || "input.slab";

  Promise.all([
    import("../compiler/compile.js"),
    import("../compiler/errors.js"),
    import("../vite/emit-slab-module.js"),
  ])
    .then(([compileMod, errorsMod, emitMod]) => {
      const result = compileMod.compileSlab(String(source), filename);
      for (const diagnostic of result.diagnostics) {
        if (diagnostic.severity === "Error") continue;
        this.emitWarning(new Error(errorsMod.formatDiagnostic(diagnostic, filename)));
      }
      const firstError = result.diagnostics.find((d) => d.severity === "Error");
      if (firstError || !result.output) {
        const diagnostic = firstError || {
          code: "E0101",
          severity: "Error",
          message: "Compilation produced no output",
          filename,
          line: 1,
        };
        callback(new Error(errorsMod.formatDiagnostic(diagnostic, filename)));
        return;
      }
      callback(null, emitMod.emitSlabModule(result.output));
    })
    .catch((error) => callback(error));
};
