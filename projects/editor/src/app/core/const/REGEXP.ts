export const REGEXP = {
  // SemVer 2.0.0 (MAJOR.MINOR.PATCH) + optional pre-release + optional build metadata
  isSemanticVersion:
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,

  // URI validation (RFC 3986-style)
  isValidURITemplate: /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s/$.?#].[^\s]*$/,

  // GCore Identifier short unique id (min 16)
  isValidId: /^[A-Za-z0-9_-]{16,}$/,

  // Qualified Ref: modelId:id (both min 16)
  isQualifiedRef: /^[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{16,}$/,

  // GCore Relation RELATION_WITH
  isValidRelation: /^[A-Z][A-Z0-9_]*$/,
};
