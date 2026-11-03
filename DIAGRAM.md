# Defence-Ops Architecture Diagram

This document provides a high-level overview of the **Defence-Ops** microservices architecture, illustrating the connections between services, external providers, and the user request flow.

## System Architecture
 
```mermaid
%%{ init: { 'themeVariables': { 'edgeLabelBackground': 'transparent', 'primaryTextColor': '#F7F7F7', 'secondaryTextColor': '#F7F7F7', 'tertiaryTextColor': '#F7F7F7' } } }%%
flowchart TD
    %% Styling Classes
    classDef container fill:#7764fc,color:#fff,stroke:#0b4884,stroke-width:2px;
    classDef outsider fill:#0070f8,color:#fff,stroke:#0b4884,stroke-width:2px;
    classDef node fill:none,color:#F7F7F7,stroke:#535C66,stroke-width:2px,stroke-dasharray: 5 5;
    classDef external fill:#3E4550,color:#fff,stroke:#666,stroke-width:2px;
    classDef database fill:#6c2b7c,color:#fff,stroke:#0b4884,stroke-width:2px;

    %% 1. User Context (Top)
    subgraph user ["User"]
        spa["<b>Web Browser</b><br/><i>Tactical Control Dashboard</i>"]
    end
    class spa outsider;

    %% 2. HPE Private Cloud AI
    subgraph pcai ["<b>HPE Private Cloud AI</b> / <i>Turnkey AI Platform</i>"]
        subgraph gateway ["&nbsp; VirtualService &nbsp;"]
            istio["&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; <b>Gateway</b> &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;<br/><i>Routes traffic to services</i>"]
        end
        class istio container;
        subgraph ns ["One pod"]

            app_ui_svc["<b>app-ui</b><br/><i>Config Provider</i>"]
            llm_svc["<b>llm-service</b><br/><i>VLM Orchestration</i>"]
            kafka_svc["<b>kafka-service</b><br/><i>Event Streaming</i>"]
            video_svc["<b>video-service</b><br/><i>MJPEG Streaming</i>"]
            class app_ui_svc,llm_svc,kafka_svc,video_svc container;
            
        end
        subgraph inf_cluster ["Inference Services [MLIS]"]
            litellm["<b>LiteLLM</b><br/><i>Model gateway, per-app key</i>"]
            mlis["<b>MLIS</b><br/><i>Local VLM / NVIDIA Triton</i>"]
        end
        class litellm,mlis container;
    end

    %% 3. External Dependencies (Bottom)
    subgraph external ["Data Fabric (Tactical/Cloud)"]
        kafka_cluster["<b>Tactical Kafka</b><br/>[Message Broker]<br/><i>Mission telemetry source</i>"]
    end
    class kafka_cluster outsider;

    %% --- Layout & Relationships ---
    spa -- "Secure Access<br/>[HTTPS]" --> istio
    istio -- "Routes UI/Config" --> app_ui_svc
    istio -- "Routes /llm" --> llm_svc
    istio -- "Routes /kafka" --> kafka_svc
    istio -- "Routes /video" --> video_svc
    
    %% Aligning lower components side-by-side
    llm_svc -- "VLM Inference" --> litellm
    litellm --> mlis
    llm_svc -- "Clip or frames<br/>[localhost]" --> video_svc
    kafka_svc -- "Pub/Sub<br/>[SASL]" --> kafka_cluster
    
    %% --- Custom Standout Styling ---
    style pcai fill:none,stroke:#01a982,stroke-width:4px,color:#01a982
    style gateway fill:#068667,stroke:#01a982,stroke-width:2px,color:#fff
    style inf_cluster fill:#068667,stroke:#01a982,stroke-width:2px,color:#fff
    class user,ns,pods,storage,external node;
```

## Service Responsibilities

### 🖥️ app-ui
- **Frontend**: A Next.js-powered dashboard providing a "Global Tactical Operations Room" experience.
- **Admin Configuration**: Manages demo settings (model, Kafka broker and topic) via `/api/v1/admin/demo-config`. Only PCAI administrators can change them; the app verifies their Keycloak sign-in token.
- **Persistence**: Saves and loads system configuration from a shared JSON file on a Persistent Volume. It holds no secrets.

### 🤖 llm-service
- **Tactical Chat**: Handles user queries and merges them with Kafka tactical context and the selected feeds.
- **Models**: Lists the models the app's LiteLLM key may use, with what each accepts (vision, video, thinking).
- **Visual Context**: Sends video-capable models one short clip of the feeds, other vision models still frames, and falls back to frames if a model refuses video.
- **Thinking**: Switches on the model's own reasoning when asked and supported, and returns it separately from the answer.

### 📡 kafka-service
- **SSE Streaming**: Provides a Server-Sent Events (SSE) endpoint at `/api/v1/kafka/stream` for real-time dashboard updates.
- **Alert Generation**: Simulations or actual production of tactical alerts to the Kafka cluster.
- **Telemetry**: Consumes raw mission data and exposes it to the UI.

### 🎥 video-service
- **Video Processing**: Serves four independent MJPEG streams representing tactical feeds.
- **VLM Readiness**: Extract sequence frames from video feeds for Vision Language Model analysis in the `llm-service`.

## Request Flow Example: Tactical Analysis

1.  **User** asks a question in the chat about "Tactical 1" feed.
2.  **app-ui** sends the prompt, the feed names and recent alerts (from **kafka-service**) to **llm-service**.
3.  **llm-service** reads the selected model from the shared configuration and checks what it accepts.
4.  **llm-service** asks **video-service** for a short clip (video models) or still frames (other vision models).
5.  **llm-service** calls the model through **LiteLLM** with the app's own key.
6.  The answer, and the model's reasoning if thinking was on, is returned to the user via the dashboard.
