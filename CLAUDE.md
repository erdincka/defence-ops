# defence-ops

A public repository (github.com/erdincka/defence-ops): no cluster's hostnames, domain, registry or record names in
committed files. Placeholders go in `tilt_config.example.json`; real values in the git-ignored `tilt_config.json`.
Deployment details for a particular cluster live outside this repository.

## Dev loop (pcai-dev-loop)

- Develop with Tilt in namespace `dev`, at `https://defence-ops-dev.<your PCAI domain>`, following the
  `pcai-dev-loop` skill. Settings are in `tilt_config.json` (git-ignored; copy `tilt_config.example.json`). Run
  `tilt up --context <context>`; never switch the current kube context.
- Never deploy into the namespace the app is imported into (usually `defence-ops`) or any namespace a PCAI app is
  installed in, with Tilt or Helm. Never edit the Tiltfile's guards out.
- Dev-only settings live in each Dockerfile's `dev` target and `dev-values.yaml`; the chart's `values.yaml` is the
  production default, and `prod` (the last target) is what releases build.
- Four images build from the repository root; each `docker_build` ignores the other services' folders, so an edit
  rebuilds or syncs only its own image.
- Run tests in a container, never on the workstation: each Python service is a uv project with its own tests (see
  the README's Development section); app-ui's `npx tsc --noEmit` and `npx eslint` run in the dev pod.
- Release with the skill's section 3: `scripts/publish_images.sh <version>` (the `prod` targets),
  `release-check.sh helm`, `chart-upload.sh`, `ezapp-switch.sh`. Images are pinned versions, never a Tilt or `dev`
  image.
- `charts/defence-ops-<version>.tgz` is the latest release's chart package, the only one, linked from the README:
  replace it (`helm package helm --destination charts`) at each release, never in between (D68).
