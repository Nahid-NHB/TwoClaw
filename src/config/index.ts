export function hasWebTools(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}
