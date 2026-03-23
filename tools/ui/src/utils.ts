export function titleToFolder(titleEn: string): string {
  return titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
