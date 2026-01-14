export const REGEXP = {
  // SemVer 2.0.0 (MAJOR.MINOR.PATCH) + optional pre-release + optional build metadata
  isSemanticVersion:
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,

  // URI validation (RFC 3986-style)
  isValidURITemplate: /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s/$.?#].[^\s]*$/,

  // GCore Identifier camelCase
  isValidId: /^[a-z_][A-Za-z0-9_.\\-]*$/,
};
