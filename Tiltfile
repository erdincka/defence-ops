# Dev loop for defence-ops on lonpcai: builds the four images, pushes them to Harbor and live-syncs
# source into the single pod. It deploys to `dev` under its own hostname, never into the
# Import Framework app's namespace `defence-ops`, whose release it would take over.
KUBE_CONTEXT = 'lonpcai'
NAMESPACE = 'dev'
ENDPOINT = 'defence-ops-dev.demo.lon-pcai.twlon.com'
PROTECTED = ['default', 'datafabric', 'defence-ops', 'istio-system', 'keycloak', 'kyverno', 'litellm',
             'metallb-system', 'mlflow', 'mlis', 'monitoring', 'nfs-csi', 'otel-collector',
             'superset', 'ui', 'welcome']
PROTECTED_PREFIXES = ['kube', 'ez', 'hpe', 'project-', 'knative', 'nvidia', 'spark', 'token']

allow_k8s_contexts(KUBE_CONTEXT)
if k8s_context() != KUBE_CONTEXT:
    fail('kube context is %s, expected %s: run `tilt up --context %s`' % (k8s_context(), KUBE_CONTEXT, KUBE_CONTEXT))
if NAMESPACE in PROTECTED:
    fail('refusing to deploy into protected namespace %s' % NAMESPACE)
for prefix in PROTECTED_PREFIXES:
    if NAMESPACE.startswith(prefix):
        fail('refusing to deploy into protected namespace %s' % NAMESPACE)

default_registry('registry.nxsg.co.uk/dev')

# Do NOT pass `only=` to docker_build: it strips source out of the images. The root .dockerignore
# keeps the build context small instead.
#
# Every image builds from the repository root, so without `ignore=` a change to one service's file
# matches no sync() of the other three images, and Tilt rebuilds all four and replaces the pod.
SERVICES = ['app-ui', 'kafka-service', 'llm-service', 'video-service']


def other_services(name, extra=[]):
    return [s for s in SERVICES if s != name] + extra


# Admin Portal (UI)
docker_build(
    'erdincka/defence-ops-app-ui',
    context='.',
    dockerfile='app-ui/Dockerfile',
    ignore=other_services('app-ui', ['common', 'assets', 'scripts', 'README.md', 'EXAMPLES.md', 'LICENSE', 'defence-ops.png', '.env.example']),
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
    ignore=other_services('kafka-service', ['assets', '*.md']),
    live_update=[
        fall_back_on(['./kafka-service/pyproject.toml', './kafka-service/uv.lock']),
        sync('./common', '/app/common'),
        sync('./kafka-service/main.py', '/app/main.py'),
        sync('./kafka-service/settings.py', '/app/settings.py'),
        sync('./kafka-service/alerts.py', '/app/alerts.py'),
    ]
)

# Render and apply the chart. SSO stays off: its AuthorizationPolicy lives in istio-system.
k8s_yaml(helm(
    './helm',
    name='defence-ops',
    namespace=NAMESPACE,
    set=[
        'ezua.virtualService.endpoint=' + ENDPOINT,
        'ezua.authorizationPolicy.enabled=false',
        'global.appEnv=development',
        'persistence.claimName=defence-ops-data',
        # No SSO in dev, so System Config is open; live update needs a writable filesystem.
        # The NetworkPolicy stays on, so dev tests it.
        'settings.auth=open',
        'securityContext.readOnlyRootFilesystem=false',
        # Next.js 16 dev serves live reload only to allowed hostnames; without it nothing hydrates.
        'global.extraEnv[0].name=ALLOWED_DEV_ORIGINS',
        'global.extraEnv[0].value=' + ENDPOINT,
        # `next dev` compiles pages in the pod: it peaked at 3.4 GiB on 2026-11-02, against 257 MiB
        # for the built app.
        'appUi.resources.limits.memory=6Gi',
    ]
))
k8s_resource('defence-ops', links=[link('https://' + ENDPOINT, 'Ops Centre (dev)')])
