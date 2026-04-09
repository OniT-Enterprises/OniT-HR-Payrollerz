import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Users,
  Shield,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ChevronLeft,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ImpersonationBanner } from "./ImpersonationBanner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

// --- Sub-components ---

function AdminNavLinks({ pathname, t }: { pathname: string; t: (key: string) => string }) {
  const adminNavItems = [
    { path: "/admin/tenants", label: t("admin.layout.tenants"), icon: Building2 },
    { path: "/admin/users", label: t("admin.layout.users"), icon: Users },
    { path: "/admin/audit", label: t("admin.layout.auditLog"), icon: FileText },
  ];

  return (
    <nav className="flex items-center gap-1 ml-8">
      {adminNavItems.map((item) => {
        const isActive = pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminHeaderRight({
  user,
  userProfile,
  isDark,
  toggleTheme,
  onNavigate,
  onSignOut,
  t,
}: {
  user: { photoURL?: string | null; email?: string | null } | null;
  userProfile: { displayName?: string | null } | null;
  isDark: boolean;
  toggleTheme: () => void;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="ml-auto flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="text-muted-foreground hover:text-foreground"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-500 text-white text-xs">
                {userProfile?.displayName?.[0] || user?.email?.[0] || "A"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium">
                {userProfile?.displayName || user?.email?.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground">{t("admin.layout.superadmin")}</p>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => onNavigate("/")}>
            <LayoutDashboard className="h-4 w-4 mr-2" />
            {t("common.dashboard")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNavigate("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            {t("common.settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut} className="text-red-600">
            <LogOut className="h-4 w-4 mr-2" />
            {t("common.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// --- Main component ---

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, userProfile, signOut } = useAuth();
  const { isImpersonating } = useTenant();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isImpersonating && <ImpersonationBanner />}

      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="flex h-16 items-center px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 mr-4 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/")}
          >
            <ChevronLeft className="h-4 w-4" />
            {t("admin.layout.backToApp")}
          </Button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <Shield className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              {t("admin.layout.adminConsole")}
            </span>
          </div>

          <AdminNavLinks pathname={location.pathname} t={t} />

          <AdminHeaderRight
            user={user}
            userProfile={userProfile}
            isDark={isDark}
            toggleTheme={toggleTheme}
            onNavigate={(path) => navigate(path)}
            onSignOut={handleSignOut}
            t={t}
          />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

