"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldAlert, MessageSquare, Play, Square, Crosshair, Upload, Activity, Settings2, Eye, Zap, ChevronLeft, ChevronRight, Settings, BookOpen } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, type Alert, type LlmModel } from "@/lib/api";
import styles from "./ops-center.module.css";
import SettingsView from "@/components/SettingsView";
import DocsModal from "@/components/DocsModal";

// Helper to resolve dynamic service URLs
// Dynamic service URL helper - kept for reference
/* 
const getBaseUrl = (envVar: string | undefined, defaultLocal: string) => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '';
    }
  }
  return envVar || defaultLocal;
};
*/


const API_BASE = ""; 

interface VideoSource {
  filename: string;
  source: string;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  reasoning?: string | null;
  notices?: string[];
}

export default function OpsCenter() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [videos, setVideos] = useState<VideoSource[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>(['', '', '', '']);
  const [playingState, setPlayingState] = useState<boolean[]>([false, false, false, false]);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [targetContext, setTargetContext] = useState<string>("smart");
  const [isSending, setIsSending] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  // The model chosen on System Config, with what it accepts; thinking is offered only if it supports it.
  const [activeModel, setActiveModel] = useState<LlmModel | null>(null);

  const [logs, setLogs] = useState<Alert[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("You are an advanced military AI assisting a Command & Control centre. Analyse visuals objectively and provide concise tactical assessments.");
  const [isKafkaConfigured, setIsKafkaConfigured] = useState<boolean | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedPrompt = localStorage.getItem("ops_system_prompt");
    if (savedPrompt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restored after hydration: the server render has no localStorage
      setSystemPrompt(savedPrompt);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ops_system_prompt", systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    // Scroll logs
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const applyVideos = useCallback((vids: VideoSource[]) => {
    setVideos(vids);
    // Default to first few videos if available (only if not already set)
    setSelectedVideos(prev => {
       // If we already have selections, don't overwrite them automatically
       if (prev.some(v => v !== "")) return prev;

       const newSelected = [...prev];
       for (let i = 0; i < 4; i++) {
         if (vids[i]) newSelected[i] = vids[i].filename;
       }
       return newSelected;
    });
  }, []);

  // State is set in promise callbacks, so effects can call these without cascading renders.
  const fetchVideos = useCallback(() =>
    fetch(`${API_BASE}/api/v1/video/list`)
      .then(res => res.json())
      .then(data => { if (data.status === 'success') applyVideos(data.data); })
      .catch(() => console.error("Failed to fetch videos.")),
  [applyVideos]);

  useEffect(() => {
    fetchVideos();

    // Check if Kafka is configured
    api.getDemoConfig()
      .then(({ data }) => setIsKafkaConfigured(!!data.kafka_broker && !!data.kafka_topic))
      .catch((err: unknown) => {
        console.error("Failed to check Kafka config", err);
        setIsKafkaConfigured(false);
      });
  }, [fetchVideos]);

  const loadActiveModel = useCallback(() =>
    api.getModels()
      .then(({ models, selected }) => models.find(m => m.id === selected) ?? null)
      .catch(() => null)
      .then(model => {
        setActiveModel(model);
        if (model?.reasoning !== true) setEnableThinking(false);
      }),
  []);

  useEffect(() => {
    // Re-read after System Config closes, as the model may have changed
    if (!isSettingsOpen) loadActiveModel();
  }, [isSettingsOpen, loadActiveModel]);

  useEffect(() => {
    if (!isKafkaConfigured) return;

    // Setup SSE for Kafka stream
    const sse = new EventSource(`${API_BASE}/api/v1/kafka/stream`);
    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, data].slice(-50)); // Keep last 50
      } catch(_err) {
         // might be plain string
      }
    };
    sse.onerror = () => {
      // quiet fail for SSE
    };
    
    return () => sse.close();
  }, [isKafkaConfigured]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    toast.loading("Uploading custom stream...");
    try {
      const res = await fetch(`${API_BASE}/api/v1/video/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      toast.dismiss();
      if (data.status === 'success') {
        toast.success("Stream uploaded.");
        fetchVideos();
      } else {
        toast.error(`Upload failed: ${data.detail || data.message}`);
      }
    } catch(_err) {
      toast.dismiss();
      toast.error("Error uploading file.");
    }
  };

  // llm-service builds the visual context itself: a clip for video models, frames otherwise.
  const askModel = async (message: string, videos: string[], displayMsg: string) => {
    setChatMessages(p => [...p, {role: 'user', content: displayMsg}]);
    setIsSending(true);
    try {
      const reply = await api.chat({
        message,
        videos,
        kafka_context: logs,
        system_prompt: systemPrompt,
        enable_thinking: enableThinking && activeModel?.reasoning === true,
      });
      setChatMessages(p => [...p, {
        role: 'bot',
        content: reply.reply,
        reasoning: reply.reasoning,
        notices: reply.notices,
      }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to reach the LLM service.";
      setChatMessages(p => [...p, {role: 'bot', content: `Error: ${errorMsg}`}]);
      toast.error(`LLM Error: ${errorMsg}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatInput("");
    let videos: string[] = [];
    if (targetContext === "smart") {
      videos = Array.from(new Set(selectedVideos.filter((vid, i) => vid && playingState[i])));
    } else if (targetContext !== "none") {
      videos = [targetContext];
    }
    await askModel(userMsg, videos, userMsg);
  };

  const handleSpecialAnalysis = async (videoFilename: string, type: 'threat' | 'objects') => {
    if (isSending || !videoFilename) return;

    const prompt = type === 'threat'
      ? "As an elite military intelligence analyst, perform an immediate threat assessment on the provided visual feed (analysing the last sequence of frames). Identify any active, imminent, or potential threats to security, personnel, or infrastructure. Provide a concise, high-priority tactical summary of risks and recommended countermeasures. Respond with authority and precision."
      : "Acting as a top-tier military reconnaissance specialist, identify all objects of interest within this video sequence. Focus on military hardware (vehicles, weaponry, comms), tactical assets, and personnel formations. Provide an itemised report detailing the nature, quantity, and suspected strategic significance of each identified object. Ensure the assessment is detailed and professional.";

    const userDisplayMsg = type === 'threat'
      ? `[TACTICAL SCAN] Initiating Threat Assessment on: ${videoFilename}`
      : `[RECONNAISSANCE] Identifying Objects of Interest in: ${videoFilename}`;

    await askModel(prompt, [videoFilename], userDisplayMsg);
  };

  const handleGenerateAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/kafka/generate`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(data.message);
      } else {
        toast.error(data.message || "Failed to generate alerts");
      }
    } catch (_err) {
      toast.error("Error communicating with Kafka service");
    }
  };

  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleResizeMove = (clientX: number) => {
      if (!isResizing) return;
      // Calculate width from the right edge, accounting for padding
      const newWidth = window.innerWidth - clientX - 64; 
      
      // Ensure we don't squeeze the left panel too much
      // Container width approx = window.innerWidth - sidebarWidth - sidePadding
      const sidebarWidth = 0; // No sidebar in this layout
      const containerWidth = window.innerWidth - sidebarWidth - 80;
      const maxAllowedWidth = Math.min(800, containerWidth - 400); // Keep at least 400px for left panel
      
      if (newWidth > 320 && newWidth < maxAllowedWidth) {
        setRightPanelWidth(newWidth);
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleResizeMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => handleResizeMove(e.touches[0].clientX);
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing]);

  const adjustPanelWidth = (delta: number) => {
    setRightPanelWidth(prev => {
      const newVal = prev + delta;
      return Math.max(320, Math.min(800, newVal));
    });
  };

  const formatFileName = (name: string) => {
    if (!name) return "";
    // Remove extension
    let base = name.split('.').slice(0, -1).join('.');
    // Replace - and _ with space
    base = base.replace(/[-_]/g, ' ');
    // Capitalize first letters of every word
    return base.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>
          <div className={styles.blinkingDot} />
           Global Defence Ops Centre
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".mp4,.mov" style={{display: 'none'}} />
           <button onClick={() => setIsDocsOpen(true)} className={styles.secondaryBtn}>
              <BookOpen size={16} /> Docs
           </button>
           <button onClick={() => fileInputRef.current?.click()} className={styles.secondaryBtn}>
              <Upload size={16} /> Mount Stream
           </button>
           <button onClick={() => setIsSettingsOpen(true)} className={styles.uploadBtn}>
              <Settings size={16} /> System Config
           </button>
        </div>
      </header>
      
      {!isSettingsOpen && (
        <div className={styles.mainContent}>
           <div className={styles.leftPanel}>
              <div className={styles.videoGrid}>
                 {[0, 1, 2, 3].map((i) => (
                   <div key={i} className={styles.videoContainer}>
                      <div className={styles.videoHeader}>
                         <select 
                           className={styles.videoSelect} 
                           value={selectedVideos[i]}
                           onChange={(e) => {
                             const newArr = [...selectedVideos];
                             newArr[i] = e.target.value;
                             setSelectedVideos(newArr);
                           }}
                         >
                            <option value="">-- No Source --</option>
                            {videos.map(v => (
                              <option key={v.filename} value={v.filename}>
                                {formatFileName(v.filename)}
                              </option>
                            ))}
                         </select>
                         
                         <div className={styles.videoControls}>
                             <button 
                               onClick={() => handleSpecialAnalysis(selectedVideos[i], 'threat')}
                               className={`${styles.analysisBtn} ${styles.threatBtn}`}
                               title="Threat Detection"
                               disabled={isSending || !selectedVideos[i]}
                             >
                                <ShieldAlert size={16} />
                             </button>
                             
                             <button 
                               onClick={() => handleSpecialAnalysis(selectedVideos[i], 'objects')}
                               className={styles.analysisBtn}
                               title="Identify Objects"
                               disabled={isSending || !selectedVideos[i]}
                             >
                                <Eye size={16} />
                             </button>

                             <button 
                               onClick={() => {
                                 const p = [...playingState]; p[i] = !p[i]; setPlayingState(p);
                               }} 
                               className={`${styles.playBtn} ${!playingState[i] ? styles.stopped : ''}`}
                             >
                                {playingState[i] ? <Square size={16} /> : <Play size={16} />}
                             </button>
                         </div>
                      </div>
                      <div className={styles.videoView}>
                          {playingState[i] && selectedVideos[i] ? (
                            <>
                              <video 
                                key={selectedVideos[i]}
                                src={`${API_BASE}/api/v1/video/raw/${selectedVideos[i]}`}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className={styles.videoStream}
                              />
                              <div className={styles.targetOverlay} />
                            </>
                          ) : (
                            <div style={{color: '#334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', fontFamily: 'monospace'}}>
                               <Crosshair size={32} opacity={0.5} />
                               <span>STREAM OFFLINE</span>
                            </div>
                          )}
                      </div>
                   </div>
                 ))}
              </div>
              
              {isKafkaConfigured && (
                <div className={styles.kafkaTerminal}>
                     <div className={styles.terminalHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <Activity size={14} /> LIVE TACTICAL ALERTS (KAFKA)
                        </div>
                        <button 
                          onClick={handleGenerateAlerts}
                          className={styles.generateBtn}
                          title="Generate Sample Alerts"
                        >
                           <Zap size={10} /> Generate Alerts
                        </button>
                     </div>
                    <div className={styles.terminalFeed}>
                       {logs.length === 0 ? (
                         <span className={styles.emptyLog}>No alerts received... Waiting for datalink...</span>
                       ) : (
                         logs.map((log, i) => (
                           <div key={i} className={styles.logEntry}>
                              <span className={styles.logTime}>[{log.timestamp !== undefined ? new Date(log.timestamp * 1000).toISOString().split('T')[1].slice(0,-1) : '--:--:--'}]</span>
                              <span className={styles[`log${log.severity}`]}>[{log.severity}]</span>
                              <span style={{color: 'white'}}>[{log.location}]</span>
                              <span>{log.message}</span>
                           </div>
                         ))
                       )}
                       <div ref={logsEndRef} />
                    </div>
                </div>
              )}
           </div>

           <div 
             className={`${styles.resizer} ${isResizing ? styles.resizerActive : ''}`} 
             onMouseDown={() => setIsResizing(true)}
             onTouchStart={() => setIsResizing(true)}
           >
             <div className={styles.resizerHandle} />
             <div className={styles.resizerButtons}>
               <button 
                 className={styles.sizeBtn} 
                 onClick={() => adjustPanelWidth(50)}
                 title="Expand Panel"
               >
                 <ChevronLeft size={14} />
               </button>
               <button 
                 className={styles.sizeBtn} 
                 onClick={() => adjustPanelWidth(-50)}
                 title="Shrink Panel"
               >
                 <ChevronRight size={14} />
               </button>
             </div>
           </div>
           
           <div className={styles.rightPanel} style={{ width: rightPanelWidth }}>
              <div className={styles.promptContainer}>
                 <div className={styles.promptHeader}>
                    <Settings2 size={16} /> ASSISTANT INSTRUCTIONS
                 </div>
                 <textarea 
                   className={styles.promptInput}
                   value={systemPrompt}
                   onChange={(e) => setSystemPrompt(e.target.value)}
                   placeholder="System prompt..."
                 />
              </div>

              <div className={styles.chatContainer}>
                 <div className={styles.chatHeader}>
                    <MessageSquare size={18} /> TACTICAL ASSISTANT
                 </div>
                 <div className={styles.chatMessages}>
                    {chatMessages.map((m, i) => (
                       <div key={i} className={`${styles.message} ${m.role === 'user' ? styles.userMsg : styles.botMsg}`}>
                          {m.role === 'user' ? (
                            m.content
                          ) : (
                            <div className={styles.markdownContent}>
                               {m.reasoning && (
                                 <details className={styles.thinkSegment}>
                                   <summary>Reasoning</summary>
                                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.reasoning}</ReactMarkdown>
                                 </details>
                               )}
                               <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                               {m.notices?.map(n => (
                                 <p key={n} className={styles.notice}>{n}</p>
                               ))}
                            </div>
                          )}
                       </div>
                    ))}
                    {isSending && (
                      <div className={`${styles.message} ${styles.botMsg}`} style={{opacity: 0.6}}>
                        Analyzing...
                      </div>
                    )}
                 </div>
                 <form onSubmit={handleChat} className={styles.chatInputWrapper}>
                    <select 
                      value={targetContext}
                      onChange={(e) => setTargetContext(e.target.value)}
                      className={styles.contextSelect}
                    >
                       <option value="smart">Context: Smart (Active Streams)</option>
                       <option value="none">Context: None</option>
                       {videos.map(v => (
                          <option key={v.filename} value={v.filename}>{v.filename}</option>
                       ))}
                    </select>
                    
                    <label
                      className={`${styles.thinkingLabel} ${activeModel?.reasoning === true ? "" : styles.thinkingDisabled}`}
                      title={activeModel?.reasoning === true
                        ? `Ask ${activeModel.id} to reason before answering`
                        : `${activeModel?.id ?? "The selected model"} does not support thinking mode`}
                    >
                       <input
                         type="checkbox"
                         checked={enableThinking}
                         disabled={activeModel?.reasoning !== true}
                         onChange={(e) => setEnableThinking(e.target.checked)}
                       />
                       <span>Thinking</span>
                    </label>

                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      className={styles.chatInput}
                      placeholder="Query intelligence..."
                      disabled={isSending}
                    />
                 </form>
              </div>
           </div>
        </div>
      )}

      {isSettingsOpen && <SettingsView onClose={() => setIsSettingsOpen(false)} />}
      {isDocsOpen && <DocsModal onClose={() => setIsDocsOpen(false)} />}
    </div>
  );
}
