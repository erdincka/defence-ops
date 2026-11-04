# Dev loop for defence-ops (skill pcai-dev-loop): builds the four images' `dev` targets, pushes them to a registry the
# cluster pulls from, deploys the chart into a dev namespace under the app's dev hostname and live-syncs source into
# the single pod. The live app is never touched: Tilt refuses PCAI's own namespaces and every namespace a PCAI app
# (EzAppConfig) is installed in, where it would take over that release's objects.
#
# Settings come from tilt_config.json (git-ignored; copy tilt_config.example.json):
#   context    kube context to deploy with (Tilt refuses any other)
#   registry   image registry the cluster pulls from, e.g. registry.example.com/dev
#   endpoint   dev hostname, e.g. defence-ops-dev.<your PCAI domain>
#   namespace  dev namespace (default dev)
#   platform   image platform (default linux/amd64, the PCAI nodes': right even when building on Apple Silicon)
#   set        extra Helm values, e.g. ["llm.existingSecret.name=my-llm-key"]
#   force      true takes the app's dev slot over from whoever holds it
# Run: tilt up --context <context>. Stop: tilt down --context <context> (frees the dev slot).
config.define_string('context')
config.define_string('registry')
config.define_string('endpoint')
config.define_string('namespace')
config.define_string('platform')
config.define_string_list('set')
config.define_bool('force')
cfg = config.parse()
for key in ['context', 'registry', 'endpoint']:
    if not cfg.get(key):
        fail('set "%s" in tilt_config.json (copy tilt_config.example.json)' % key)

APP = 'defence-ops'
CHART = './helm'
DEV_VALUES = 'dev-values.yaml'  # committed dev-only chart values; never used in production
KUBE_CONTEXT = cfg['context']
NAMESPACE = cfg.get('namespace', 'dev')
ENDPOINT = cfg['endpoint']
PLATFORM = cfg.get('platform', 'linux/amd64')

# ── Guards ──────────────────────────────────────────────────────────────────────────────────────────────────────
# PCAI's own namespaces, and defence-ops, where the app is usually imported.
PROTECTED = ['default', 'datafabric', 'defence-ops', 'istio-system', 'keycloak', 'kyverno', 'litellm',
             'metallb-system', 'mlflow', 'mlis', 'monitoring', 'nfs-csi', 'otel-collector', 'superset', 'ui', 'welcome']
PROTECTED_PREFIXES = ['kube', 'ez', 'hpe', 'project-', 'knative', 'nvidia', 'spark', 'token']

allow_k8s_contexts(KUBE_CONTEXT)
if k8s_context() != KUBE_CONTEXT:
    fail('kube context is %s, expected %s: run `tilt up --context %s`' % (k8s_context(), KUBE_CONTEXT, KUBE_CONTEXT))
if NAMESPACE in PROTECTED or [p for p in PROTECTED_PREFIXES if NAMESPACE.startswith(p)]:
    fail('refusing to deploy into protected namespace %s' % NAMESPACE)


def kubectl(args):
    """Runs a read-only kubectl command against the configured context; empty output on error."""
    return str(local('kubectl --context %s %s 2>/dev/null || true' % (KUBE_CONTEXT, args), quiet=True,
                     echo_off=True)).strip()


# Where PCAI apps are installed (EzAppConfig .spec.options.namespace): the live apps, never a dev loop.
live = kubectl("get ezappconfig -o jsonpath='{range .items[*]}{.spec.options.namespace}{\"\\n\"}{end}'").split()
if NAMESPACE in live:
    fail('refusing to deploy into %s: a PCAI app is installed there, and Tilt would take over its objects. Use dev'
         % NAMESPACE)

# One dev slot per app: a ConfigMap names who holds it. `tilt down` deletes it with the rest.
ME = str(local('git config user.email || whoami', quiet=True, echo_off=True)).strip()
SLOT = APP + '-dev-slot'
holder = kubectl("-n %s get configmap %s -o jsonpath='{.data.holder} {.data.since}'" % (NAMESPACE, SLOT)).split(' ')
if holder[0] and holder[0] != ME and not cfg.get('force', False):
    fail(('the %s dev slot is held by %s since %s. Ask them to run `tilt down`, or set "force": true in ' +
          'tilt_config.json to take it over') % (APP, holder[0], holder[1] if len(holder) > 1 else '?'))
since = holder[1] if holder[0] == ME and len(holder) > 1 else str(local('date -u +%FT%TZ', quiet=True)).strip()
k8s_yaml(encode_yaml({
    'apiVersion': 'v1', 'kind': 'ConfigMap',
    'metadata': {'name': SLOT, 'namespace': NAMESPACE,
                 'labels': {'app.kubernetes.io/instance': APP, 'app.kubernetes.io/managed-by': 'tilt'}},
    'data': {'holder': ME, 'since': since, 'endpoint': ENDPOINT},
}))

default_registry(cfg['registry'])

# ── Images ──────────────────────────────────────────────────────────────────────────────────────────────────────
# Do NOT pass `only=` to docker_build: it strips source out of the images. .dockerignore keeps the build context
# small instead.
#
# Every image builds from the repository root, so without `ignore=` a change to one service's file matches no
# sync() of the other three images, and Tilt rebuilds all four and replaces the pod.
SERVICES = ['app-ui', 'kafka-service', 'llm-service', 'video-service']


def other_services(name, extra=[]):
    return [s for s in SERVICES if s != name] + extra


# Admin Portal (UI)
docker_build(
    'erdincka/defence-ops-app-ui',
    context='.',
    dockerfile='app-ui/Dockerfile',
    target='dev',
    platform=PLATFORM,
    ignore=other_services('app-ui', ['common', 'assets', 'scripts', 'README.md', 'EXAMPLES.md', 'LICENSE',
                                     'defence-ops.png', '.env.example', 'tilt_config*.json']),
    live_update=[
        fall_back_on(['./app-ui/package.json', './app-ui/package-lock.json']),
        sync('./app-ui/app', '/app/app'),
        sync('./app-ui/components', '/app/components'),
        sync('./app-ui/lib', '/app/lib'),
        sync('./USAGE.md', '/app/USAGE.md'),
        sync('./DIAGRAM.md', '/app/DIAGRAM.md'),
    ]
)

# Video Service
docker_build(
    'erdincka/defence-ops-video-service',
    context='.',
    dockerfile='video-service/Dockerfile',
    target='dev',
    platform=PLATFORM,
    ignore=other_services('video-service', ['*.md']),
    live_update=[
        fall_back_on(['./video-service/pyproject.toml', './video-service/uv.lock']),
        sync('./common', '/app/common'),
        sync('./video-service/main.py', '/app/main.py'),
    ]
)

# LLM Service
docker_build(
    'erdincka/defence-ops-llm-service',
    context='.',
    dockerfile='llm-service/Dockerfile',
    target='dev',
    platform=PLATFORM,
    ignore=other_services('llm-service', ['assets', '*.md']),
    live_update=[
        fall_back_on(['./llm-service/pyproject.toml', './llm-service/uv.lock']),
        sync('./common', '/app/common'),
        sync('./llm-service/main.py', '/app/main.py'),
        sync('./llm-service/settings.py', '/app/settings.py'),
        sync('./llm-service/litellm_client.py', '/app/litellm_client.py'),
        sync('./llm-service/media.py', '/app/media.py'),
        sync('./llm-service/prompts.py', '/app/prompts.py'),
    ]
)

# Kafka Service
docker_build(
    'erdincka/defence-ops-kafka-service',
    context='.',
    dockerfile='kafka-service/Dockerfile',
    target='dev',
    platform=PLATFORM,
    ignore=other_services('kafka-service', ['assets', '*.md']),
    live_update=[
        fall_back_on(['./kafka-service/pyproject.toml', './kafka-service/uv.lock']),
        sync('./common', '/app/common'),
        sync('./kafka-service/main.py', '/app/main.py'),
        sync('./kafka-service/settings.py', '/app/settings.py'),
        sync('./kafka-service/alerts.py', '/app/alerts.py'),
    ]
)

# ── Chart ───────────────────────────────────────────────────────────────────────────────────────────────────────
# Dev-only values (no SSO policy, open System Config, writable filesystem, memory for `next dev`) are in
# dev-values.yaml. The dev hostname comes from tilt_config.json, so no committed file names a cluster.
k8s_yaml(helm(
    CHART,
    name=APP,
    namespace=NAMESPACE,
    values=[DEV_VALUES] if os.path.exists(DEV_VALUES) else [],
    set=[
        'ezua.virtualService.endpoint=' + ENDPOINT,
        # Next.js 16 dev serves live reload only to allowed hostnames; without it nothing hydrates.
        'global.extraEnv[0].name=ALLOWED_DEV_ORIGINS',
        'global.extraEnv[0].value=' + ENDPOINT,
    ] + cfg.get('set', []),
))
k8s_resource(APP, links=[link('https://' + ENDPOINT, 'Ops Centre (dev)')])
