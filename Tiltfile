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

# Admin Portal (UI)
docker_build(
    'erdincka/defence-ops-app-ui',
    context='.',
    dockerfile='app-ui/Dockerfile',
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
    live_update=[
        fall_back_on(['./video-service/requirements.txt']),
        sync('./common', '/app/common'),
        sync('./video-service/main.py', '/app/main.py'),
    ]
)

# LLM Service
docker_build(
    'erdincka/defence-ops-llm-service',
    context='.',
    dockerfile='llm-service/Dockerfile',
    live_update=[
        fall_back_on(['./llm-service/requirements.txt']),
        sync('./common', '/app/common'),
        sync('./llm-service/main.py', '/app/main.py'),
        sync('./llm-service/model_registry.py', '/app/model_registry.py'),
    ]
)

# Kafka Service
docker_build(
    'erdincka/defence-ops-kafka-service',
    context='.',
    dockerfile='kafka-service/Dockerfile',
    live_update=[
        fall_back_on(['./kafka-service/requirements.txt']),
        sync('./common', '/app/common'),
        sync('./kafka-service/main.py', '/app/main.py'),
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
        # `next dev` compiles pages in the pod: it peaked at 3.4 GiB on 2026-11-02, against 257 MiB
        # for the built app.
        'appUi.resources.limits.memory=6Gi',
    ]
))
k8s_resource('defence-ops', links=[link('https://' + ENDPOINT, 'Ops Centre (dev)')])
