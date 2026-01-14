import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

const SIGNER_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export interface SignerData {
  id: string;
  name: string;
  email: string;
  order: number;
  color: string;
}

interface MultiSignerInputProps {
  signers: SignerData[];
  onChange: (signers: SignerData[]) => void;
  maxSigners?: number;
}

export function MultiSignerInput({ signers, onChange, maxSigners = 6 }: MultiSignerInputProps) {
  const addSigner = () => {
    if (signers.length >= maxSigners) {
      toast.error(`Maximum ${maxSigners} signers allowed`);
      return;
    }

    const newSigner: SignerData = {
      id: crypto.randomUUID(),
      name: "",
      email: "",
      order: signers.length + 1,
      color: SIGNER_COLORS[signers.length % SIGNER_COLORS.length],
    };

    onChange([...signers, newSigner]);
  };

  const removeSigner = (id: string) => {
    if (signers.length <= 1) {
      toast.error("At least one signer is required");
      return;
    }

    const newSigners = signers
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, order: idx + 1 }));

    onChange(newSigners);
  };

  const updateSigner = (id: string, updates: Partial<SignerData>) => {
    onChange(
      signers.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const moveSigner = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= signers.length) return;

    const newSigners = [...signers];
    const [moved] = newSigners.splice(fromIndex, 1);
    newSigners.splice(toIndex, 0, moved);

    onChange(newSigners.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Recipients ({signers.length})</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSigner}
          disabled={signers.length >= maxSigners}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Recipient
        </Button>
      </div>

      <div className="space-y-3">
        {signers.map((signer, index) => (
          <Card key={signer.id} className="border">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                    style={{ backgroundColor: signer.color }}
                  >
                    {signer.order}
                  </div>
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => moveSigner(index, index - 1)}
                      disabled={index === 0}
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`name-${signer.id}`} className="text-xs">
                      Name *
                    </Label>
                    <Input
                      id={`name-${signer.id}`}
                      value={signer.name}
                      onChange={(e) => updateSigner(signer.id, { name: e.target.value })}
                      placeholder="Full name"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`email-${signer.id}`} className="text-xs">
                      Email *
                    </Label>
                    <Input
                      id={`email-${signer.id}`}
                      type="email"
                      value={signer.email}
                      onChange={(e) => updateSigner(signer.id, { email: e.target.value })}
                      placeholder="email@example.com"
                      className="h-9"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => removeSigner(signer.id)}
                  disabled={signers.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        All recipients will receive the document for signature at the same time.
      </p>
    </div>
  );
}
