import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, MessageCircle, Zap, Smile } from "lucide-react";
import type { PersonalizationSettings } from "@shared/schema";

export default function Personalization() {
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<PersonalizationSettings>({
    tone: "friendly",
    responseLength: "moderate",
    formality: "medium",
    includeEmojis: true,
  });

  const handleSave = () => {
    console.log("Saving settings:", settings);
    toast({
      title: "Settings saved",
      description: "Your personalization preferences have been updated.",
    });
  };

  const getPreviewText = () => {
    const responses: Record<string, string> = {
      "professional-brief": "I understand your request. I'll get that done right away.",
      "friendly-moderate": "Hey there! I'd be happy to help you with that. Let me take care of it for you.",
      "casual-detailed": "Sure thing! I can definitely help you out with that. Let me walk you through what I'm going to do and how it'll work.",
      "formal-brief": "Understood. I shall proceed with your request immediately.",
    };
    
    const key = `${settings.tone}-${settings.responseLength}`;
    return responses[key] || "I'm here to assist you. How may I help you today?";
  };

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-chart-2/5 to-primary/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      
      <div className="max-w-4xl mx-auto p-6 space-y-8 relative z-10">
        <div className="text-center space-y-3 py-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-chart-2 to-primary flex items-center justify-center shadow-lg shadow-chart-2/20">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-chart-2 via-primary to-chart-2 bg-clip-text text-transparent" data-testid="text-page-title">
            Personalization Engine
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Customize how your AI assistant communicates with you for a truly personalized experience
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-8 space-y-6 backdrop-blur-xl bg-card/80 border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-left duration-700 delay-150">
            <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent rounded-lg -z-10" />
            
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-chart-1/20 to-chart-1/10 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-chart-1" />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold">Communication Tone</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose how Coolie communicates
                    </p>
                  </div>
                </div>
                <RadioGroup
                  value={settings.tone}
                  onValueChange={(value) =>
                    setSettings({ ...settings, tone: value as PersonalizationSettings["tone"] })
                  }
                  className="space-y-3"
                >
                  {[
                    { value: "professional", label: "Professional", desc: "Formal and business-focused" },
                    { value: "casual", label: "Casual", desc: "Relaxed and conversational" },
                    { value: "friendly", label: "Friendly", desc: "Warm and approachable" },
                    { value: "formal", label: "Formal", desc: "Strictly professional" },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 cursor-pointer border border-transparent hover:border-primary/20">
                      <RadioGroupItem value={option.value} id={`tone-${option.value}`} data-testid={`radio-tone-${option.value}`} />
                      <Label htmlFor={`tone-${option.value}`} className="font-normal cursor-pointer flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-chart-3" />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold">Response Length</Label>
                    <p className="text-sm text-muted-foreground">
                      Control response detail level
                    </p>
                  </div>
                </div>
                <RadioGroup
                  value={settings.responseLength}
                  onValueChange={(value) =>
                    setSettings({ ...settings, responseLength: value as PersonalizationSettings["responseLength"] })
                  }
                  className="space-y-3"
                >
                  {[
                    { value: "brief", label: "Brief", desc: "Short and to the point" },
                    { value: "moderate", label: "Moderate", desc: "Balanced responses" },
                    { value: "detailed", label: "Detailed", desc: "Comprehensive explanations" },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 cursor-pointer border border-transparent hover:border-primary/20">
                      <RadioGroupItem value={option.value} id={`length-${option.value}`} data-testid={`radio-length-${option.value}`} />
                      <Label htmlFor={`length-${option.value}`} className="font-normal cursor-pointer flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-chart-4/20 to-chart-4/10 flex items-center justify-center">
                    <Smile className="h-5 w-5 text-chart-4" />
                  </div>
                  <div>
                    <Label className="text-lg font-semibold">Formality Level</Label>
                    <p className="text-sm text-muted-foreground">
                      Adjust formality in responses
                    </p>
                  </div>
                </div>
                <RadioGroup
                  value={settings.formality}
                  onValueChange={(value) =>
                    setSettings({ ...settings, formality: value as PersonalizationSettings["formality"] })
                  }
                  className="space-y-3"
                >
                  {[
                    { value: "low", label: "Low", desc: "Very casual language" },
                    { value: "medium", label: "Medium", desc: "Standard professional" },
                    { value: "high", label: "High", desc: "Very formal language" },
                  ].map((option) => (
                    <div key={option.value} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 cursor-pointer border border-transparent hover:border-primary/20">
                      <RadioGroupItem value={option.value} id={`formality-${option.value}`} data-testid={`radio-formality-${option.value}`} />
                      <Label htmlFor={`formality-${option.value}`} className="font-normal cursor-pointer flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.desc}</div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors duration-200">
                <div className="space-y-1">
                  <Label htmlFor="include-emojis" className="text-base font-semibold cursor-pointer">
                    Include Emojis
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Allow emojis in responses
                  </p>
                </div>
                <Switch
                  id="include-emojis"
                  checked={settings.includeEmojis}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, includeEmojis: checked })
                  }
                  data-testid="switch-emojis"
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-chart-2"
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full bg-gradient-to-r from-chart-2 to-primary hover:shadow-lg hover:shadow-chart-2/30 transition-all duration-300 hover:scale-[1.02]" data-testid="button-save">
              <Sparkles className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
          </Card>

          <Card className="p-8 backdrop-blur-xl bg-card/80 border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-right duration-700 delay-300 h-fit sticky top-6">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg -z-10" />
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-xl mb-2 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-chart-2/20 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                  Live Preview
                </h3>
                <p className="text-sm text-muted-foreground">
                  Here's how Coolie will respond with your current settings
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shrink-0 shadow-lg">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="bg-gradient-to-br from-primary/10 to-chart-2/10 rounded-2xl rounded-tl-none p-4 flex-1 border border-primary/20">
                    <p className="text-sm leading-relaxed">
                      {getPreviewText()}
                      {settings.includeEmojis && " ✨"}
                    </p>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tone:</span>
                    <span className="font-medium capitalize">{settings.tone}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Length:</span>
                    <span className="font-medium capitalize">{settings.responseLength}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Formality:</span>
                    <span className="font-medium capitalize">{settings.formality}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Emojis:</span>
                    <span className="font-medium">{settings.includeEmojis ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
