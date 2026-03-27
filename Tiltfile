# PCAI Demo Baseline Tiltfile

# Load .env file
load('ext://dotenv', 'dotenv')
dotenv()

allow_k8s_contexts(os.environ['KUBE_CONTEXT'])
default_registry('registry.' + os.environ['DOMAIN'])

# Services
# Administrative configuration is now handled directly by app-ui (Next.js API routes).

# Admin Portal (UI)
docker_build(
    'app-ui',
    '.',
    dockerfile='app-ui/Dockerfile',
    only=[
        'app-ui',
        'README.md',
        'DIAGRAM.md',
    ],
    build_args={
        'DOMAIN': os.environ.get('DOMAIN', 'localhost')
    },
    live_update=[

        sync('./app-ui/app', '/app/app'),
        sync('./app-ui/lib', '/app/lib'),
        sync('./app-ui/public', '/app/public'),
        sync('./README.md', '/app/README.md'),
        sync('./DIAGRAM.md', '/app/DIAGRAM.md'),
    ]
)

# Video Service
docker_build(
    "video-service",
    ".",
    dockerfile="video-service/Dockerfile",
    only=[
        "video-service",
        "common",
        "assets/videos",
    ],
    live_update=[
        sync("./common", "/app/common"),
        sync("./video-service/main.py", "/app/main.py"),
    ]
)
# LLM Service
docker_build(
    "llm-service",
    ".",
    dockerfile="llm-service/Dockerfile",
    only=[
        "llm-service",
        "common",
    ],
    live_update=[
        sync("./common", "/app/common"),
        sync("./llm-service/main.py", "/app/main.py"),
        sync("./llm-service/model_registry.py", "/app/model_registry.py"),
    ]
)
# Kafka Service
docker_build(
    "kafka-service",
    ".",
    dockerfile="kafka-service/Dockerfile",
    only=[
        "kafka-service",
        "common",
    ],
    live_update=[
        sync("./common", "/app/common"),
        sync("./kafka-service/main.py", "/app/main.py"),
    ]
)

# Infra Services Helm deployment
# We use local to ensure templates are re-rendered and watched correctly
infra_yaml = local('helm template defence-ops ./helm --namespace defence-ops --set ezua.virtualService.endpoint=defence-ops.' + os.environ['DOMAIN'] + ' --set global.env=development --set appUi.image=app-ui:latest --set videoService.image=video-service:latest --set llmService.image=llm-service:latest --set kafkaService.image=kafka-service:latest')
k8s_yaml(infra_yaml)

# Ensure Tilt watches the helm chart directory for any template changes
watch_file('./helm')
