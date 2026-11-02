# Defence-Ops: Modern AI-Native Tactical Intelligence

A microservices-based demo application showcasing modern AI-native tactical intelligence capabilities on **HPE Private Cloud AI (PCAI)**.

## 🚀 Deployment on HPE PCAI 

Use Import Framework wizard to load the helm chart `defence-op.<version>.tgz` and use `defence-ops.png` image as logo. Provide a namespace (you can skip the release name).

Instead, if you have kubectl and helm installed and configured to your PCAI cluster, you can use the following commands to deploy the application:

### 📋 Prerequisites

1.  **Kubectl & Helm**: Ensure you have `kubectl` and `helm` installed and configured to your PCAI cluster.
2.  **Namespace**: Create the target namespace for the application.
    ```bash
    kubectl create namespace defence-ops
    ```

### 📦 Installation via Helm

The deployment is managed by a unified Helm chart located in `./helm`.

1.  **Customize Domain**: Update the `ezua.virtualService.endpoint` in `helm/values.yaml` or set it via command line.
2.  **Install Chart**:
    ```bash
    helm install defence-ops ./helm --namespace defence-ops \
      --set ezua.virtualService.endpoint=defence-ops.<YOUR_DOMAIN_NAME>
    ```
3.  **Verify Status**:
    ```bash
    kubectl get pods -n defence-ops
    ```

### 🔓 Accessing the Application

Once successfully deployed, the application will be available at:
`https://defence-ops.<YOUR_DOMAIN_NAME>`

First step is to set up the `system config`. Make sure you select the correct API format, when using MLIS, select `OpenAI compatible` and make sure you are using Vision Language Model, e.g. `nemotron-nano-12b-v2-vl` for best results, or `qwen3-vl:8b`). LLM Endpoint and API Token can be found in the `Model Endpoints` screen on AI Essentials.

### ▶️ Using the Application

- Select a video from dropdown menu for each grid box. Depending on your network speed, videos may take a while to load (but they will be cached for future use) when you click the play icon.

- Shield and Eye icons trigger pre-defined AI requests, while the chat box allows for custom queries. Shield triggers "Threat Detection" and Eye triggers "Object Identification" requests.

- When using chatbox, 
    - you can change the `Assistant Instructions` to customize the model behaviour, 
    - select a specific video for `Context` or use `Smart Context` to ask questions on what is actually seen on the screen (multiple videos + kafka messages),
    - enable 'thinking' mode to let the model think before answering and show its reasoning process.

## 🛠 Microservices Architecture

Since chart 0.1.0 the four services run as containers in one pod (`deployment/defence-ops`), each on its own port behind one Service: `app-ui` 3000, `kafka-service` 8001, `llm-service` 8002, `video-service` 8003. Settings saved on the System Config page live in `config.json` on the `app-data` volume, which the backends read directly; API keys and passwords are never sent back to the browser.

- **`app-ui`**: Next.js frontend providing the global tactical dashboard and administration portal.
- **`video-service`**: FastAPI service handling MJPEG streaming, video uploads, and sequence frame extraction.
- **`llm-service`**: FastAPI service integrating with KServe endpoints for Vision Language Model (VLM) analysis and tactical chat.
- **`kafka-service`**: FastAPI service providing real-time telemetry streaming via SSE and tactical alert generation.

## 🏗 Operations & Maintenance

If you want to make changes, you can build your own images and replace them in the `helm/values.yaml` file, or using `Configure` option on the Tools & Frameworks page.

### 🧱 Building and Publishing Images

A helper script is provided to build and push all microservices to Docker Hub. By default, it uses the `erdincka` user and the `defence-ops-` prefix.

1.  **Prerequisites**: Log in to Docker Hub: `docker login`.
2.  **Execute Publish Script**:
    ```bash
    ./scripts/publish_images.sh 1.0.0
    ```
    *Replace `1.0.0` with your desired tag.*

### 🛠 Development with Tilt on lonpcai

```bash
KUBECONFIG=~/.kube/lon-master.yaml tilt up --context lonpcai
```

Tilt builds the four images, pushes them to Harbor (`registry.nxsg.co.uk/dev`) and runs the pod in namespace `dev` at `https://defence-ops-dev.demo.lon-pcai.twlon.com`, with live reload and without SSO. Stop it with `tilt down --context lonpcai`. The Tiltfile refuses to deploy into `defence-ops`: a Tilt run there on 2026-05-29 took over the Import Framework release's Services and, after the next upgrade, left the app with no endpoints from 24 October to 2 November 2026.

### 🚢 Releasing on lonpcai

The Import Framework app is EzAppConfig `defence-ops-0.0.1-1774573363791`; its job runs `helm upgrade` from the platform chartmuseum with the record's `chartVersion` and `values`.

1. Publish the images with the release tag, e.g. `./scripts/publish_images.sh 1.1.0` (the chart pins `global.image.tag`).
2. Package the chart: `helm package helm -d dist`.
3. Upload it to the chartmuseum (a protected namespace, so the cluster owner does this):
   ```bash
   kubectl --context lonpcai create --raw /api/v1/namespaces/ez-chartmuseum-ns/services/chartmuseum:8080/proxy/api/charts -f dist/defence-ops-0.1.0.tgz
   ```
4. Point the record at the new version, with values that only set the endpoint:
   ```bash
   kubectl --context lonpcai patch ezappconfig defence-ops-0.0.1-1774573363791 --type merge \
     -p '{"spec":{"chartVersion":"0.1.0","values":"ezua:\n  virtualService:\n    endpoint: \"defence-ops.${DOMAIN_NAME}\"\n    istioGateway: \"istio-system/ezaf-gateway\"\n"}}'
   ```
5. Check: the record shows `ready` with health `ok`, and `deployment/defence-ops` in `defence-ops` is 4/4 ready.

**Roll back:** patch `chartVersion` back to the previous version, which stays in the chartmuseum.

---

© 2026 HPE. For demonstration purposes only.
