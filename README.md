# Defence-Ops: Modern AI-Native Tactical Intelligence

A microservices-based demo application showcasing modern AI-native tactical intelligence capabilities on **HPE Private Cloud AI (PCAI)**.

## 🚀 Deployment on HPE PCAI

Follow these steps to deploy the application into your HPE PCAI environment.

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
      --set ezua.virtualService.endpoint=defence-ops.<YOUR_DOMAIN_NAME> \
      --set global.env=production
    ```
3.  **Verify Status**:
    ```bash
    kubectl get pods -n defence-ops
    ```

### 🔓 Accessing the Application

Once successfully deployed, the application will be available at:
`https://defence-ops.<YOUR_DOMAIN_NAME>`

## 🛠 Microservices Architecture

- **`app-ui`**: Next.js frontend providing the global tactical dashboard and administration portal.
- **`video-service`**: FastAPI service handling MJPEG streaming, video uploads, and sequence frame extraction.
- **`llm-service`**: FastAPI service integrating with KServe endpoints for Vision Language Model (VLM) analysis and tactical chat.
- **`kafka-service`**: FastAPI service providing real-time telemetry streaming via SSE and tactical alert generation.

## 🏗 Operations & Maintenance

### 🧱 Building and Publishing Images

A helper script is provided to build and push all microservices to Docker Hub. By default, it uses the `erdincka` user and the `defence-ops-` prefix.

1.  **Prerequisites**: Log in to Docker Hub: `docker login`.
2.  **Execute Publish Script**:
    ```bash
    ./scripts/publish_images.sh 1.0.0
    ```
    *Replace `1.0.0` with your desired tag.*

### 🛠 Local Development with Tilt

For live-updating development in a Kubernetes environment:
1. Ensure your `.env` file is configured with `DOMAIN` and `KUBE_CONTEXT`.
2. Run `tilt up`.

---

© 2026 HPE. For demonstration purposes only.
