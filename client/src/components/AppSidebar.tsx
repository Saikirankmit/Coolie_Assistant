import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Home, MessageSquare, CheckSquare, Settings, Sparkles, LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const menuItems = [
  { title: "Home", url: "/", icon: Home, gradient: "from-primary/10 to-chart-1/10" },
  { title: "Chat", url: "/chat", icon: MessageSquare, gradient: "from-chart-1/10 to-chart-2/10" },
  { title: "Tasks", url: "/tasks", icon: CheckSquare, gradient: "from-chart-3/10 to-chart-4/10" },
  { title: "Personalization", url: "/personalization", icon: Sparkles, gradient: "from-chart-2/10 to-primary/10" },
  { title: "Settings", url: "/settings", icon: Settings, gradient: "from-chart-4/10 to-chart-5/10" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  return (
    <Sidebar className="border-r-2">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-chart-2/5 pointer-events-none" />
      
      <SidebarHeader className="p-6 relative">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-110">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
            Coolie
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 ml-13">Your AI Assistant</p>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2 px-3">
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "group relative overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02]",
                        isActive && "shadow-lg"
                      )}
                      data-testid={`link-nav-${item.title.toLowerCase()}`}
                    >
                      <a href={item.url}>
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                          item.gradient,
                          isActive && "opacity-100"
                        )} />
                        <item.icon className={cn(
                          "h-5 w-5 transition-all duration-300 relative z-10",
                          isActive && "scale-110"
                        )} />
                        <span className="font-medium relative z-10">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="p-4 relative">
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-chart-2/10 border-2 border-primary/20 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-11 w-11 border-2 border-background shadow-lg">
                <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-chart-2 text-primary-foreground font-semibold">
                  {user?.displayName?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" data-testid="text-username">
                  {user?.displayName || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-300 group"
              onClick={() => signOut()}
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
              Sign Out
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
