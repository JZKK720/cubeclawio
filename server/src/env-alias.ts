export function resolvePaperclipEnvValue(
  key: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const cubeKey = key.startsWith("PAPERCLIP_") ? `CUBECLOUDIO_${key.slice("PAPERCLIP_".length)}` : undefined;
  const cubeValue = cubeKey ? env[cubeKey] : undefined;
  if (cubeValue !== undefined) return cubeValue;
  return env[key];
}
