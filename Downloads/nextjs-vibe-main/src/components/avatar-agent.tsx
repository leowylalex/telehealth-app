"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";

interface AvatarMessage {
  type: "speak" | "process" | "config" | "response";
  content?: string;
  isProcessing?: boolean;
  config?: {
    projectId?: string;
    userId?: string;
  };
}

interface AvatarAgentProps {
  projectId?: string;
  onMessage?: (message: string) => void;
  onError?: (error: string) => void;
  className?: string;
  height?: string;
  avatarUrl?: string; // Allow custom avatar URL
}

export const AvatarAgent = ({ 
  projectId, 
  onMessage, 
  onError, 
  className = "", 
  height = "600px",
  avatarUrl = "http://127.0.0.1:5501/"
}: AvatarAgentProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Handle messages from the avatar iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: Only accept messages from the avatar origin
      if (event.origin !== "http://127.0.0.1:5501") {
        return;
      }

      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        
        switch (data.type) {
          case "ready":
            setIsLoading(false);
            setIsConnected(true);
            // Send initial configuration to avatar
            sendToAvatar({
              type: "config",
              config: { projectId }
            });
            break;
            
          case "message":
            if (data.content && onMessage) {
              onMessage(data.content);
            }
            break;
            
          case "error":
            if (data.error && onError) {
              onError(data.error);
            }
            break;
            
          default:
            console.log("Unknown message from avatar:", data);
        }
      } catch (error) {
        console.error("Error parsing avatar message:", error);
        onError?.("Communication error with avatar");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [projectId, onMessage, onError]);

  // Send messages to the avatar iframe
  const sendToAvatar = (message: AvatarMessage) => {
    if (iframeRef.current?.contentWindow && isConnected) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify(message),
          "http://127.0.0.1:5501"
        );
      } catch (error) {
        console.error("Error sending message to avatar:", error);
        onError?.("Failed to communicate with avatar");
      }
    }
  };

  // Expose method to speak to avatar
  const speakToAvatar = (content: string, isProcessing = false) => {
    sendToAvatar({
      type: "speak",
      content,
      isProcessing
    });
  };

  // Expose method to send processing state
  const setProcessingState = (isProcessing: boolean) => {
    sendToAvatar({
      type: "process",
      isProcessing
    });
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    // Give iframe a moment to initialize
    setTimeout(() => {
      if (!isConnected) {
        setIsLoading(false);
        onError?.("Avatar failed to connect");
      }
    }, 5000);
  };

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg z-10"
          style={{ height }}
        >
          <div className="flex flex-col items-center gap-2">
            <Loader2Icon className="size-6 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading avatar...</p>
          </div>
        </div>
      )}
      
      {!isConnected && !isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-background border rounded-lg"
          style={{ height }}
        >
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Avatar not available</p>
            <p className="text-xs text-muted-foreground">
              Make sure the avatar server is running on http://127.0.0.1:5501
            </p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={avatarUrl}
        width="100%"
        height={height}
        onLoad={handleIframeLoad}
        className={`border-none rounded-lg ${isLoading || !isConnected ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        allow="microphone; camera"
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ border: "none", borderRadius: "8px" }}
      />
    </div>
  );
};

// Export methods for external use
export type AvatarAgentRef = {
  speakToAvatar: (content: string, isProcessing?: boolean) => void;
  setProcessingState: (isProcessing: boolean) => void;
};