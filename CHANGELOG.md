# Changelog

## Current Testing Line

This line is Schema 2.0 only.

Highlights:

- `.slab` files are shader libraries with `<shader_frame>` entries.
- App code creates instances with `shader_frame.<id>(library) { ... }`.
- `canvas_item` is the 2D canvas job.
- `canvas_25d` is the first-class layered/parallax canvas job.
- `spatial mode="augment"` samples upstream canvas output through `CANVAS_TEXTURE` / `CANVAS_UV`.
- `postprocess` samples upstream output through `SCREEN_TEXTURE` / `SCREEN_UV`.
- Postprocess calls auto-compose the upstream `canvas_item` or `canvas_25d`, ordered spatial augments, and terminal post pass.
- The Vite transform for `shader_frame.*` block syntax is scanner-based and errors on malformed blocks.

Breaking from old Schema 1.0 behavior:

- `<shader>` is rejected.
- `version="1.0"` is rejected.
- The old `useShader` flow is not part of the current public API.
