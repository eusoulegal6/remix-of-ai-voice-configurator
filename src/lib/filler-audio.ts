export const getVersionedAudioUrl = (
  audioUrl: string | null | undefined,
  updatedAt?: string | null
) => {
  if (!audioUrl) return null;

  const version = updatedAt ? Date.parse(updatedAt) : Date.now();
  const separator = audioUrl.includes("?") ? "&" : "?";

  return `${audioUrl}${separator}v=${Number.isNaN(version) ? Date.now() : version}`;
};