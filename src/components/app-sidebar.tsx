"use client";

import {
  Home,
  Users,
  Briefcase,
  FileText,
  LogOut,
  LayoutDashboard,
  NotepadTextDashed,
  Settings,
  ChevronUp,
  User,
  Sun,
  Moon,
  Pencil,
  CalendarClock,
  History,
  BarChart3,
  Bot,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrgSwitcher } from "@/components/org-switcher";

type OrgRole = "OWNER" | "ADMIN" | "MEMBER";

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
};

function hasMinRole(userRole: string | undefined, minRole: OrgRole): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole as OrgRole] ?? 0;
  const minLevel = ROLE_HIERARCHY[minRole] ?? 0;
  return userLevel >= minLevel;
}

interface AppSidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  company?: {
    companyName?: string | null;
    companyLogoUrl?: string | null;
  };
  organizations?: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    role: string;
  }[];
  activeOrgId?: string;
  activeRole?: string;
}

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  minRole?: OrgRole;
  subItems?: { title: string; url: string }[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Home",
    items: [
      { title: "Dashboard", url: "/", icon: Home },
      { title: "Projects", url: "/projects", icon: Briefcase },
      { title: "Task Board", url: "/board", icon: LayoutDashboard },
      { title: "Clients", url: "/clients", icon: Users },
      { title: "Invoices", url: "/invoices", icon: FileText },
      { title: "Recurring", url: "/recurring-invoices", icon: CalendarClock },
      { title: "Reports", url: "/reports", icon: BarChart3 },
      { title: "Activity", url: "/activity", icon: History },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "General", url: "/settings", icon: Settings, minRole: "ADMIN" },
      { title: "Organization", url: "/settings/organization", icon: Pencil, minRole: "ADMIN" },
      { title: "Team", url: "/settings/team", icon: Users, minRole: "ADMIN" },
      { title: "SOW Templates", url: "/settings/sow-template", icon: NotepadTextDashed, minRole: "ADMIN" },
      { title: "Subscription", url: "/settings/subscription", icon: FileText, minRole: "OWNER" },
      { title: "AI Assistant", url: "/settings/agent", icon: Bot, minRole: "ADMIN" },
    ],
  },
];

export function AppSidebar({ user, company, organizations, activeOrgId, activeRole }: AppSidebarProps) {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  const companyName = company?.companyName || "ProjectBill";
  const companyLogo = company?.companyLogoUrl;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <OrgSwitcher
              currentOrgName={companyName}
              currentOrgLogo={companyLogo}
              organizations={organizations}
              activeOrgId={activeOrgId}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const filteredItems = group.items.filter(
            (item) => !item.minRole || hasMinRole(activeRole, item.minRole)
          );
          if (filteredItems.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/50 tracking-wide mb-1 px-4 mt-2 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {filteredItems.map((item) => {
                    const isActive =
                      item.url === "/"
                        ? pathname === "/"
                        : item.url === "/settings"
                          ? pathname === "/settings"
                          : pathname?.startsWith(item.url);

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={`rounded-lg transition-all duration-200 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
                        >
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="mb-2">
            <div className="border-b border-sidebar-border pb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full text-left rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200">
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span>Appearance</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">Light</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">Dark</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">System</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-lg transition-all duration-200">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.image || ""} alt={user?.name || ""} />
                    <AvatarFallback className="rounded-lg">{user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name || "User"}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">{user?.email || "user@example.com"}</span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" align="end" sideOffset={8}>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.image || ""} alt={user?.name || ""} />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">{user?.name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name || "User"}</span>
                      <span className="truncate text-xs">{user?.email || "user@example.com"}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-sidebar-foreground/70" />
                      <span>My profile</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-left flex items-center cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4 text-sidebar-foreground/70" />
                      <span>Log out</span>
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
          <SidebarMenuItem className="px-2 pt-2 mt-2">
            <div className="text-center text-xs text-sidebar-foreground/40 font-medium">
              Version v{process.env.NEXT_PUBLIC_APP_VERSION}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
