const warnedLegacyKeys = new Set<string>();

function warnLegacyFallback(legacyKey: string, modernKey: string): void {
  if (warnedLegacyKeys.has(legacyKey)) return;
  warnedLegacyKeys.add(legacyKey);
  // Keep warning terse and actionable: set the new key while preserving compatibility.
  console.warn(`[deprecation] ${legacyKey} is deprecated; use ${modernKey} instead.`);
}

export function resolvePaperclipEnvValue(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const cubeKey = key.startsWith("PAPERCLIP_") ? `CUBECLOUDIO_${key.slice("PAPERCLIP_".length)}` : undefined;
  const cubeValue = cubeKey ? env[cubeKey] : undefined;
  if (cubeValue !== undefined) return cubeValue;
  const legacyValue = env[key];
  if (cubeKey && legacyValue !== undefined) {
    warnLegacyFallback(key, cubeKey);
  }
  return legacyValue;
}

export function __resetPaperclipEnvAliasWarningsForTests(): void {
  warnedLegacyKeys.clear();
}
