"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

interface AgentConfig {
  provider: string;
  model: string;
  temperature: number;
  proactiveMode: boolean;
  locale: "id" | "en";
}

const DEFAULT_CONFIG: AgentConfig = {
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-20250514",
  temperature: 0.7,
  proactiveMode: true,
  locale: "id",
};

export default function AgentSettingsPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/agent/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch {
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useState(() => { loadConfig(); });

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agent/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success("AI settings saved successfully");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Memuat...</div>;
  if (!config) return null;

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant Settings</h1>
        <p className="text-muted-foreground mt-1">Configure the AI Financial Co-Pilot to your needs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Umum</CardTitle>
          <CardDescription>Pengaturan dasar AI assistant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Select value={config.provider} onValueChange={(v) => setConfig({ ...config, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="openai">OpenAI (coming soon)</SelectItem>
                <SelectItem value="anthropic">Anthropic (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Model</Label>
            <Input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
          </div>

          <div className="grid gap-2">
            <Label>Temperatur: {config.temperature.toFixed(1)}</Label>
            <Slider
              min={0} max={1} step={0.1}
              value={[config.temperature]}
              onValueChange={([v]) => setConfig({ ...config, temperature: v })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Bahasa</Label>
            <Select value={config.locale} onValueChange={(v: "id" | "en") => setConfig({ ...config, locale: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="id">Indonesia</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Mode Proaktif</Label>
              <p className="text-sm text-muted-foreground">AI memberikan saran tanpa diminta</p>
            </div>
            <Switch checked={config.proactiveMode} onCheckedChange={(v) => setConfig({ ...config, proactiveMode: v })} />
          </div>
        </CardContent>
      </Card>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Simpan Pengaturan
      </button>
    </div>
  );
}
