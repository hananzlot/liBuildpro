import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PortalPasscodeGateProps {
  projectAddress: string | null;
  token: string;
  companyName?: string;
  companyLogoUrl?: string;
  onVerified: () => void;
}

// Extract house number from address (first numeric portion)
// Returns null if address is only a zip code or no valid street number found
function extractHouseNumber(address: string | null): string | null {
  if (!address) return null;
  
  const trimmed = address.trim();

  // If the entire address is just a zip code (5 digits, optionally with zip+4), skip passcode
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) return null;

  // Match the first sequence of digits at the start of the address
  // Handles: "123 Main St", "123A Main St", "Unit 5, 123 Main St", etc.
  const match = trimmed.match(/^(?:Unit\s*\d+[,\s]*)?(\d+)/i);
  if (match) {
    // Make sure the matched number isn't a lone 5-digit zip at the start (unlikely but safe)
    const candidate = match[1];
    if (candidate.length === 5 && /^\d{5}$/.test(candidate) && !trimmed.match(/^\d{5}\s+\S/)) {
      return null;
    }
    return candidate;
  }
  
  // Fallback: find any number sequence that looks like a house number (not 5-digit zip)
  const fallbackMatch = trimmed.match(/\b(\d{1,4}[A-Za-z]?)\b/);
  return fallbackMatch ? fallbackMatch[1] : null;
}

// Storage key for verified sessions
function getVerifiedKey(token: string): string {
  return `portal_verified_${token}`;
}

export function PortalPasscodeGate({ 
  projectAddress, 
  token, 
  companyName, 
  companyLogoUrl,
  onVerified 
}: PortalPasscodeGateProps) {
  const { toast } = useToast();
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const correctPasscode = extractHouseNumber(projectAddress);

  // Check if already verified in this session
  useEffect(() => {
    const verified = sessionStorage.getItem(getVerifiedKey(token));
    if (verified === 'true') {
      onVerified();
    }
  }, [token, onVerified]);

  // Lock out after 5 failed attempts for 30 seconds
  useEffect(() => {
    if (attempts >= 5) {
      setIsLocked(true);
      const timer = setTimeout(() => {
        setIsLocked(false);
        setAttempts(0);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [attempts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLocked) {
      setError('Too many attempts. Please wait 30 seconds.');
      return;
    }

    if (!correctPasscode) {
      // If no house number found, allow access with warning
      console.warn('No house number found in address, allowing access');
      sessionStorage.setItem(getVerifiedKey(token), 'true');
      onVerified();
      return;
    }

    const trimmedPasscode = passcode.trim();
    
    if (trimmedPasscode === correctPasscode) {
      // Mark as verified for this session
      sessionStorage.setItem(getVerifiedKey(token), 'true');
      toast({
        title: 'Access granted',
        description: 'Welcome to your customer portal.',
      });
      onVerified();
    } else {
      setAttempts(prev => prev + 1);
      setError('Incorrect passcode. Please try again.');
      setPasscode('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl border-0 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary to-primary/50" />
        
        <CardHeader className="text-center pb-2 pt-8">
          {companyLogoUrl ? (
            <div className="w-24 h-24 mx-auto mb-4 rounded-xl bg-white shadow-lg overflow-hidden ring-2 ring-slate-100">
              <img 
                src={companyLogoUrl} 
                alt={companyName || 'Company Logo'} 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock className="h-10 w-10 text-primary" />
            </div>
          )}
          <CardTitle className="text-2xl font-bold text-slate-900">
            {companyName || 'Customer Portal'}
          </CardTitle>
          <p className="text-slate-500 text-sm mt-2">
            Please enter your passcode to access the portal
          </p>
        </CardHeader>
        
        <CardContent className="pb-8 pt-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Passcode
              </label>
              <p className="text-xs text-slate-500">
                Enter your house number from the project address
              </p>
              <div className="relative">
                <Input
                  type={showPasscode ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter house number"
                  className="pr-10 text-center text-lg tracking-widest"
                  disabled={isLocked}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLocked && (
              <div className="text-amber-600 text-sm bg-amber-50 p-3 rounded-lg text-center">
                Too many failed attempts. Please wait 30 seconds.
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isLocked || !passcode.trim()}
            >
              <Lock className="h-4 w-4 mr-2" />
              Access Portal
            </Button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-6">
            Your passcode is the house number from your project address.
            <br />
            If you're having trouble, please contact us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}