import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { PersonalizationSettings } from "@shared/schema";

export default function Personalization() {
  const { toast } = useToast();
  
  // TODO: remove mock functionality - load from backend
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

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Personalization Engine
          </h1>
          <p className="text-muted-foreground">
            Customize how your AI assistant communicates with you
          </p>
        </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Communication Tone</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose how you want Coolie to communicate
              </p>
              <RadioGroup
                value={settings.tone}
                onValueChange={(value) =>
                  setSettings({ ...settings, tone: value as PersonalizationSettings["tone"] })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="professional" id="tone-professional" data-testid="radio-tone-professional" />
                  <Label htmlFor="tone-professional" className="font-normal cursor-pointer">
                    Professional - Formal and business-focused
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="casual" id="tone-casual" data-testid="radio-tone-casual" />
                  <Label htmlFor="tone-casual" className="font-normal cursor-pointer">
                    Casual - Relaxed and conversational
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="friendly" id="tone-friendly" data-testid="radio-tone-friendly" />
                  <Label htmlFor="tone-friendly" className="font-normal cursor-pointer">
                    Friendly - Warm and approachable
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="formal" id="tone-formal" data-testid="radio-tone-formal" />
                  <Label htmlFor="tone-formal" className="font-normal cursor-pointer">
                    Formal - Strictly professional
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-medium">Response Length</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Control how detailed the responses should be
              </p>
              <RadioGroup
                value={settings.responseLength}
                onValueChange={(value) =>
                  setSettings({ ...settings, responseLength: value as PersonalizationSettings["responseLength"] })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="brief" id="length-brief" data-testid="radio-length-brief" />
                  <Label htmlFor="length-brief" className="font-normal cursor-pointer">
                    Brief - Short and to the point
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="moderate" id="length-moderate" data-testid="radio-length-moderate" />
                  <Label htmlFor="length-moderate" className="font-normal cursor-pointer">
                    Moderate - Balanced responses
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="detailed" id="length-detailed" data-testid="radio-length-detailed" />
                  <Label htmlFor="length-detailed" className="font-normal cursor-pointer">
                    Detailed - Comprehensive explanations
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-medium">Formality Level</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Adjust the level of formality in responses
              </p>
              <RadioGroup
                value={settings.formality}
                onValueChange={(value) =>
                  setSettings({ ...settings, formality: value as PersonalizationSettings["formality"] })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="low" id="formality-low" data-testid="radio-formality-low" />
                  <Label htmlFor="formality-low" className="font-normal cursor-pointer">
                    Low - Very casual language
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="formality-medium" data-testid="radio-formality-medium" />
                  <Label htmlFor="formality-medium" className="font-normal cursor-pointer">
                    Medium - Standard professional
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="high" id="formality-high" data-testid="radio-formality-high" />
                  <Label htmlFor="formality-high" className="font-normal cursor-pointer">
                    High - Very formal language
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="include-emojis" className="text-base font-medium">
                  Include Emojis
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow the assistant to use emojis in responses
                </p>
              </div>
              <Switch
                id="include-emojis"
                checked={settings.includeEmojis}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, includeEmojis: checked })
                }
                data-testid="switch-emojis"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} className="w-full" data-testid="button-save">
              Save Preferences
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-medium mb-2">Preview</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Here's how Coolie might respond with your current settings:
          </p>
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm leading-relaxed">
              {settings.tone === "professional" && settings.responseLength === "brief" &&
                "I understand your request. I'll get that done right away."}
              {settings.tone === "friendly" && settings.responseLength === "moderate" &&
                "Hey there! I'd be happy to help you with that. Let me take care of it for you."}
              {settings.tone === "casual" && settings.responseLength === "detailed" &&
                "Sure thing! I can definitely help you out with that. Let me walk you through what I'm going to do and how it'll work."}
              {settings.tone === "formal" && settings.responseLength === "brief" &&
                "Understood. I shall proceed with your request immediately."}
              {!["professional", "friendly", "casual", "formal"].includes(settings.tone) &&
                "I'm here to assist you. How may I help you today?"}
              {settings.includeEmojis && " ✨"}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
