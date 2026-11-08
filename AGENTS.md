<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- The app is a static, backend-free demo: default data is synthetic; optional financial CSV summaries are processed only in the browser; state lives in `src/lib/demo/store.ts` (localStorage). Why: it must deploy to GitHub Pages with no servers, credentials or external account access.
- All permission checks go through `src/lib/demo/permissions.ts` and domain actions in `src/lib/demo/actions.ts`; UI only mirrors them. Why: mirrors the spec's "enforce on every request" design.
- The AI assistant maps questions to the approved analytics catalog in `src/lib/demo/analytics.ts`; numbers never come from free text. Why: spec requirement that all figures come from function outputs.
- `GITHUB_PAGES=true BASE_PATH=/<repo>/` switches vite.config to SPA/static output; router reads `import.meta.env.BASE_URL` as basepath. Why: GitHub Pages serves under a sub-path.
- Shared brand styling is defined in global semantic tokens and the app kit; landing imagery is bundled locally. Why: keeps all demo screens consistent and portable to static hosting.
- The shared app kit owns the brand mark and assistant identity; restaurant imagery stays locally bundled and identity-only changes preserve conversation primitives. Why: keeps GitHub Pages portable without changing chat behavior.
- Monthly finance reports use the independent integer-cent engine in `src/lib/demo/finance.ts`, persisted through the demo store and owner-authorized domain actions; source summaries never use legacy tax estimates. Why: missing inputs and source quality must withhold unsupported financial metrics.
