import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Camera } from "lucide-react";
import type { UserPreferences } from "@shared/schema";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  // TODO: remove mock functionality - load from backend
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "system",
    notifications: true,
    language: "en",
  });

  const handleSaveProfile = () => {
    console.log("Saving profile");
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved.",
    });
  };

  const handleSavePreferences = () => {
    console.log("Saving preferences:", preferences);
    toast({
      title: "Preferences saved",
      description: "Your settings have been updated.",
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile and application preferences
          </p>
        </div>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || ""} />
                    <AvatarFallback className="text-2xl">
                      {user?.displayName?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    onClick={() => console.log("Change avatar")}
                    data-testid="button-change-avatar"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1">
                  <p className="font-medium" data-testid="text-display-name">{user?.displayName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  defaultValue={user?.displayName || ""}
                  data-testid="input-display-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user?.email || ""}
                  disabled
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <Button onClick={handleSaveProfile} data-testid="button-save-profile">
                Save Profile
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Preferences</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="notifications">Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for new tasks and messages
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={preferences.notifications}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, notifications: checked })
                  }
                  data-testid="switch-notifications"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Input
                  id="language"
                  value={preferences.language}
                  onChange={(e) =>
                    setPreferences({ ...preferences, language: e.target.value })
                  }
                  data-testid="input-language"
                />
              </div>

              <Button onClick={handleSavePreferences} data-testid="button-save-preferences">
                Save Preferences
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-destructive/50">
          <div>
            <h2 className="text-xl font-semibold mb-2 text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Irreversible actions that affect your account
            </p>
            <Button
              variant="destructive"
              onClick={() => console.log("Delete account")}
              data-testid="button-delete-account"
            >
              Delete Account
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
