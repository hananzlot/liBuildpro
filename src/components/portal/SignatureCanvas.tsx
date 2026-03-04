import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eraser, Check } from 'lucide-react';

interface SignatureCanvasProps {
  onSignatureComplete: (data: {
    type: 'typed' | 'drawn';
    data: string;
    font?: string;
  }) => void;
  signerName: string;
  isInitials?: boolean;
}

const SIGNATURE_FONTS = [
  { name: 'Dancing Script', value: "'Dancing Script', cursive" },
  { name: 'Great Vibes', value: "'Great Vibes', cursive" },
  { name: 'Pacifico', value: "'Pacifico', cursive" },
  { name: 'Satisfy', value: "'Satisfy', cursive" },
];

export function SignatureCanvas({ onSignatureComplete, signerName, isInitials = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [typedName, setTypedName] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].value);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [activeTab, setActiveTab] = useState<'type' | 'draw'>('draw');

  // Store a ref to the callback to avoid stale closures
  const onCompleteRef = useRef(onSignatureComplete);
  onCompleteRef.current = onSignatureComplete;

  // Auto-complete typed signature whenever name or font changes (including on mount)
  useEffect(() => {
    if (activeTab === 'type' && typedName.trim()) {
      onCompleteRef.current({
        type: 'typed',
        data: typedName,
        font: selectedFont,
      });
    }
  }, [typedName, selectedFont, activeTab]);

  useEffect(() => {
    // Load Google Fonts for signatures
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Satisfy&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();

    // Reset for drawing
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Auto-apply drawn signature when user lifts pen/finger
      const canvas = canvasRef.current;
      if (canvas && hasDrawn) {
        const dataUrl = canvas.toDataURL('image/png');
        onSignatureComplete({
          type: 'drawn',
          data: dataUrl,
        });
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw signature line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 30);
    ctx.lineTo(rect.width - 20, rect.height - 30);
    ctx.stroke();

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    setHasDrawn(false);
    onSignatureComplete(null as any);
  };

  const handleComplete = () => {
    if (activeTab === 'type') {
      if (!typedName.trim()) return;
      onSignatureComplete({
        type: 'typed',
        data: typedName,
        font: selectedFont,
      });
    } else {
      if (!hasDrawn) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const dataUrl = canvas.toDataURL('image/png');
      onSignatureComplete({
        type: 'drawn',
        data: dataUrl,
      });
    }
  };

  const isValid = activeTab === 'type' ? typedName.trim().length > 0 : hasDrawn;

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => {
        const newTab = v as 'type' | 'draw';
        setActiveTab(newTab);
        // Clear parent signature when switching to draw tab so user must explicitly apply
        if (newTab === 'draw') {
          onSignatureComplete(null as any);
        }
      }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="draw">Draw Signature</TabsTrigger>
          <TabsTrigger value="type">Type Signature</TabsTrigger>
        </TabsList>

        <TabsContent value="type" className="space-y-4">
          <div className="space-y-2">
            <Label>Type your full legal name</Label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Your full name"
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>Choose a signature style</Label>
            <div className="grid grid-cols-2 gap-2">
              {SIGNATURE_FONTS.map((font) => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => setSelectedFont(font.value)}
                  className={`p-4 border rounded-lg text-center transition-colors ${
                    selectedFont === font.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span
                    style={{ fontFamily: font.value, fontSize: '24px' }}
                    className="text-foreground"
                  >
                    {isInitials 
                      ? (typedName || signerName || 'Your Name').split(' ').map(w => w[0]).join('').toUpperCase()
                      : (typedName || signerName || 'Your Name')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {typedName && (
            <div className="p-6 bg-muted/30 rounded-lg border-2 border-dashed">
              <p className="text-sm text-muted-foreground mb-2">{isInitials ? 'Initials' : 'Signature'} Preview:</p>
              <p
                style={{ fontFamily: selectedFont, fontSize: '32px' }}
                className="text-foreground"
              >
                {isInitials ? typedName.split(' ').map(w => w[0]).join('').toUpperCase() : typedName}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="draw" className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Draw your {isInitials ? 'initials' : 'signature'} below</Label>
              <Button variant="ghost" size="sm" onClick={clearCanvas}>
                <Eraser className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
            <div className="border-2 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-40 cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Use your mouse or finger to draw your {isInitials ? 'initials' : 'signature'}
            </p>
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
