import { useSearchParams, useNavigate } from "react-router-dom";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, ArrowLeft, ArrowRight, X } from "lucide-react";
import { useState, useRef } from "react";

/**
 * Embeds an external URL in an iframe within the app.
 * Used for the "Web Search" tab functionality.
 */
export default function ExternalBrowser() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { closeTab, tabs, activeTabId } = useAppTabs();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const url = searchParams.get("url") || "https://www.google.com";
  
  const handleClose = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
      closeTab(currentTab.id);
    }
    navigate("/");
  };
  
  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };
  
  const handleOpenExternal = () => {
    window.open(url, "_blank");
  };

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Browser toolbar */}
        <div className="h-10 border-b bg-muted/30 flex items-center gap-2 px-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          <div className="flex-1 px-2">
            <div className="bg-background border rounded px-3 py-1 text-sm text-muted-foreground truncate">
              {url}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleOpenExternal}
            title="Open in new browser tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Iframe content */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="External Browser"
          />
        </div>
      </div>
    </AppLayout>
  );
}
