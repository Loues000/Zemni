export const UNSORTED_FOLDER_SLUG = "__unsorted";

export function isReservedFolderName(name: string): boolean {
  return name.trim().toLowerCase() === UNSORTED_FOLDER_SLUG;
}

export function encodeFolderSlug(name: string): string {
  return encodeURIComponent(name.trim());
}

export function decodeFolderSlug(slug: string): string {
  return decodeURIComponent(slug);
}
