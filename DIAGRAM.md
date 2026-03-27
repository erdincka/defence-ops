# Defence-Ops Architecture Diagram

This document provides a high-level overview of the **Defence-Ops** microservices architecture, illustrating the connections between services, external providers, and the user request flow.

## System Architecture
 
```mermaid
%%{init: { 'theme': 'base', 'themeVariables': { 'primaryColor': '#0070F8', 'primaryTextColor': '#F7F7F7', 'primaryBorderColor': '#62E5F6', 'lineColor': '#05CC93', 'secondaryColor': '#7764FC', 'tertiaryColor': '#00E0AF', 'nodeBorder': '#B1B9BE', 'mainBkg': '#111212', 'textColor': '#E6E8E9', 'edgeLabelBackground': '#3E4550', 'clusterBkg': '#111212', 'clusterBorder': '#7D8A92' } } }%%
graph TB
    subgraph "External Resources"
        Kafka["Kafka Cluster<br/>(Tactical Events)"]
    end

    subgraph "HPE PCAI Cluster (defence-ops namespace)"
        Gateway["Istio Gateway<br/>(ezaf-gateway)"]
        
        UI["<b>app-ui</b><br/>Next.js Dashboard & Admin API"]
        
        subgraph "Backend Services"
            LS["<b>llm-service</b><br/>FastAPI: Tactical Chat & Discovery"]
            KS["<b>kafka-service</b><br/>FastAPI: SSE & Alert Generation"]
            VS["<b>video-service</b><br/>FastAPI: MJPEG & Frame Extraction"]
        end
        
        PVC[("Persistent Volume<br/>(config.json)")]

        LLM["Inference Services<br/>(KServe/OpenAI Endpoints)"]
    end

    User((User Browser))

    %% User Interaction
    User -->|HTTPS| Gateway
    Gateway --> UI
    Gateway -->|Forwarded API Calls| LS
    Gateway -->|Forwarded API Calls| KS
    Gateway -->|Streamed Video| VS

    %% Service Connections
    UI <-->|Config R/W| PVC
    KS -.->|Fetch Config| UI
    LS -.->|Fetch Config| UI
    
    %% External Integration
    KS <-->|Pub/Sub| Kafka
    LS <-->|V1/Chat/Completions| LLM
    
    %% Data Flow
    VS -.->|Source Frames| LS
    KS -.->|SSE Events| UI
```

## Service Responsibilities

### 🖥️ app-ui
- **Frontend**: A Next.js-powered dashboard providing a "Global Tactical Operations Room" experience.
- **Admin Configuration**: Manages demo settings (LLM endpoints, Kafka credentials) via `/api/v1/admin/demo-config`.
- **Persistence**: Saves and loads system configuration from a shared JSON file on a Persistent Volume.

### 🤖 llm-service
- **Tactical Chat**: Handles user queries and merges them with Kafka tactical context or image/video frames.
- **Model Discovery**: Automatically discovers available `InferenceServices` in the cluster or validates external OpenAI-compatible providers.
- **Inference Integration**: Orchestrates calls to modern LLMs (e.g., Qwen, DeepSeek, Llama) for tactical analysis.

### 📡 kafka-service
- **SSE Streaming**: Provides a Server-Sent Events (SSE) endpoint at `/api/v1/kafka/stream` for real-time dashboard updates.
- **Alert Generation**: Simulations or actual production of tactical alerts to the Kafka cluster.
- **Telemetry**: Consumes raw mission data and exposes it to the UI.

### 🎥 video-service
- **Video Processing**: Serves four independent MJPEG streams representing tactical feeds.
- **VLM Readiness**: Extract sequence frames from video feeds for Vision Language Model analysis in the `llm-service`.

## Request Flow Example: Tactical Analysis

1.  **User** asks a question in the chat about "Tactical 1" feed.
2.  **app-ui** requests the latest frames for "Tactical 1" from **video-service**.
3.  **app-ui** sends the prompt + frames + recent alerts (from **kafka-service**) to **llm-service**.
4.  **llm-service** consults its configuration (fetched from **app-ui** via the internal API).
5.  **llm-service** calls the configured **Inference Endpoint** (e.g., a KServe deployment).
6.  The result is returned to the user via the dashboard.
