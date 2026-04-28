// Default Entirety alias map.
//
// Keys are the namespaces exposed on `Entirety.*` (PascalCase by convention).
// Values are the real npm specifiers passed to dynamic import().
//
// This object is intentionally mutable — `Entirety.register(...)` edits it
// in place so user-registered aliases participate in the same lookup.

export const aliases = {
  Lodash: "lodash",
  Axios: "axios",
  React: "react",
  MUI: "@mui/material",
};
