import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
          toast({
            title: "Error",
            description: "Please enter your name",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        await signUp(email, password, displayName);
        toast({
          title: "Account created",
          description: "Welcome to Coolie!",
        });
      } else {
        await signIn(email, password);
        toast({
          title: "Welcome back",
          description: "Successfully signed in",
        });
      }
    } catch (error: any) {
      let errorMessage = "An error occurred";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errorMessage = "Invalid email or password";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-chart-2/10">
        <div className="relative">
          <div className="animate-spin h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full" />
          <div className="absolute inset-0 animate-pulse">
            <Sparkles className="h-6 w-6 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-chart-2/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-chart-2/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <Card className="w-full max-w-md p-8 space-y-6 backdrop-blur-xl bg-card/80 border-2 shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-chart-2/5 rounded-lg -z-10" />
        
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg shadow-primary/20 animate-in zoom-in duration-500 delay-150">
              <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent animate-in fade-in slide-in-from-top-2 duration-500 delay-300">
            {isSignUp ? "Join Coolie" : "Welcome Back"}
          </h1>
          <p className="text-muted-foreground animate-in fade-in duration-500 delay-400">
            Your Personal AI Assistant with Context Retention
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label htmlFor="displayName" className="text-sm font-medium">Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                data-testid="input-name"
                className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
              className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              data-testid="input-password"
              className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
            />
            {isSignUp && (
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-chart-2 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02]"
            size="lg"
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                <span>Please wait...</span>
              </div>
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setEmail("");
              setPassword("");
              setDisplayName("");
            }}
            className="text-primary hover:text-chart-2 font-medium transition-colors duration-200 hover:underline"
            data-testid="button-toggle-mode"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Secure Authentication</span>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </Card>
    </div>
  );
}
