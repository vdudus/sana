/** Each demo screen declares independent metadata rather than inheriting the layout title. */
export function pageHead(title: string, description: string) {
  return { meta: [
    { title: `${title} — SANA` },
    { name: "description", content: description.replaceAll("ADI", "SANA") },
    { property: "og:title", content: `${title} — SANA` },
    { property: "og:description", content: description.replaceAll("ADI", "SANA") },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
}
