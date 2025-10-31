import { Card } from "@/components/ui/card";
import { WebsiteOpener } from "@/components/WebsiteOpener";
import { Globe, Link as LinkIcon, Search } from "lucide-react";

export default function Website() {
  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-primary/5 to-chart-2/5">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Website Browser</h1>
          <p className="text-muted-foreground">
            Enter a website URL or describe what you want to open. The AI assistant will help you navigate to the right place.
          </p>
        </div>

        <Card className="p-6">
          <WebsiteOpener />
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Smart Search</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Just describe what you're looking for and let the AI find the right website for you.
              For example: "Open Amazon's homepage" or "Take me to the BBC news site".
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Direct Access</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter a direct URL to open any website instantly. The AI will handle the navigation and ensure a smooth experience.
            </p>
          </Card>

          <Card className="p-6 space-y-4 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <LinkIcon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Intelligent Navigation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              The AI assistant can also help you navigate within websites. It can click links, fill forms, and perform actions based on your instructions.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}