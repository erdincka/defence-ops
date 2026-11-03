# Defence-Ops: User Guide & Demo Walkthrough

This guide provides a step-by-step walkthrough for demonstrating the **Defence-Ops** tactical intelligence dashboard. It assumes the application is already deployed and the UI is open in your browser.

## ⚙️ Phase 1: Initial Configuration

Before starting the demo, you must configure the AI and Data Fabric settings. This only needs to be done once or when you need to switch models/clusters.

1.  **Open Settings**: Click the **System Config** (gear icon) in the navigation bar. Only PCAI administrators can change these settings; everyone else sees them read-only, with the reason.
2.  **Model**: Pick a model from the list of models this app's key may use on the in-cluster LiteLLM. Badges show whether it takes **Vision**, **Video** and **Thinking**; choose one with Vision.
    *   Models with Video receive a short clip of the selected feeds; other vision models receive still frames.
    *   The chat's **Thinking** toggle is available only for models with Thinking.
3.  **Data Fabric (Optional)**:
    *   To stream real-time telemetry, enter the **Broker** (`broker-host:port`) and the **Topic**.
    *   The credentials are a Kubernetes Secret the cluster administrator sets up; they are not entered here.
4.  **Save**: Click "Save Configuration" to apply the settings.

---

## 🚀 Phase 2: Tactical Demonstration Flow

The dashboard provides real-time analysis of tactical video feeds. Follow this sequence to highlight the core capabilities:

### 1. Visualizing Tactical Feeds
- Use the dropdown menus in each grid cell to select different tactical video sources.
- Click the **Play** icon to start the stream. Feeds are processed in real-time by the `video-service`.

### 2. Tactical Analysis (Shield & Eye)
- **Object Identification (Eye Icon)**: Click this on any feed to trigger the "What objects are in this scene?" request. It demonstrates rapid VLM inference.
- **Threat Detection (Shield Icon)**: Click this to trigger a "Scan for potential tactical threats" request. Notice how the model identifies risks specific to the visual context.

### 3. Advanced Tactical Chat
The chat provides the most flexible way to interact with the AI. Highlight these features:

#### 🧠 Thinking Mode
- **Checked**: The model will perform "Chain of Thought" reasoning. Use this for complex tactical assessments where logic steps are important.
- **Unchecked**: The model provides direct, faster responses. Recommended for simple identification tasks.

#### 🎯 Context Selection
- **Individual Video Context**: Select a specific video (e.g., "Drone-Alpha") from the Context dropdown. The AI will only "see" and answer questions about that specific feed.
- **Smart Context**: This is the "God View" mode. It captures screenshots from *all* active video feeds and combines them with recent Kafka telemetry. Use this for questions like *"Is there any coordinated movement across all sectors?"* or *"Compare the activity in Sector A and B."*

---

## 💡 Demo Tips

- **Latency**: Mention that initial video loads might take a few seconds as the `video-service` warms up the MJPEG stream.
- **Assistant Instructions**: Show how you can modify the "Assistant Instructions" in the chat to change the model's persona (e.g., "Report in brief military style" vs "Provide detailed technical analysis").
- **Architecture**: If technical questions arise, open the **Docs** modal and select the **DIAGRAM** tab to show the microservices architecture.

---
© 2026 HPE. For demonstration purposes only.
