module.exports = function shaderlabTransformLoader(source, inputMap) {
  const callback = this.async();
  const filename = this.resourcePath || "input.js";

  import("../vite/shader-frame-transform.js")
    .then((mod) => {
      const result = mod.transformShaderFrameCalls(String(source), filename);
      callback(null, result.code, inputMap);
    })
    .catch((error) => callback(error));
};
