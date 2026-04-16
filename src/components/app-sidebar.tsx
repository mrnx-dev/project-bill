/* eslint-disable @next/next/no-img-element */
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
  ChevronsUpDown,
  GalleryVerticalEnd,
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
}

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
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
      {
        title: "Dashboard",
        url: "/",
        icon: Home,
      },
      {
        title: "Projects",
        url: "/projects",
        icon: Briefcase,
      },
      {
        title: "Task Board",
        url: "/board",
        icon: LayoutDashboard,
      },
      {
        title: "Clients",
        url: "/clients",
        icon: Users,
      },
      {
        title: "Invoices",
        url: "/invoices",
        icon: FileText,
      },
      {
        title: "Recurring",
        url: "/recurring-invoices",
        icon: CalendarClock,
      },
      {
        title: "Reports",
        url: "/reports",
        icon: BarChart3,
      },
      {
        title: "Activity",
        url: "/activity",
        icon: History,
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        title: "General",
        url: "/settings",
        icon: Settings,
      },
      {
        title: "SOW Templates",
        url: "/settings/sow-template",
        icon: NotepadTextDashed,
      },
      {
        title: "Subscription",
        url: "/settings/subscription",
        // Using a similar generic icon since we don't have lucide's CreditCard imported yet
        icon: FileText, 
      },
      {
        title: "AI Assistant",
        url: "/settings/agent",
        icon: Bot,
      },
    ],
  },
];

export function AppSidebar({ user, company }: AppSidebarProps) {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  const companyName = company?.companyName || "ProjectBill";
  const companyLogo = company?.companyLogoUrl;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-lg"
                >
                  <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                    {companyLogo ? (
                      <img src={companyLogo} alt={companyName} className="h-full w-full object-cover" />
                    ) : (
                      <GalleryVerticalEnd className="size-4" />
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-base">{companyName}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                <div className="flex items-center justify-between p-2">
                  <DropdownMenuItem className="gap-2 flex-1 cursor-pointer">
                    <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden">
                      {companyLogo ? (
                        <img src={companyLogo} alt={companyName} className="h-full w-full object-cover" />
                      ) : (
                        <GalleryVerticalEnd className="size-4 shrink-0" />
                      )}
                    </div>
                    {companyName}
                  </DropdownMenuItem>
                  <Link href="/settings" className="text-muted-foreground hover:text-foreground text-xs relative z-10 p-1 flex items-center justify-center rounded-sm hover:bg-muted/50 cursor-pointer">
                    <Pencil className="size-3.5" />
                  </Link>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2 cursor-pointer relative overflow-hidden">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <div className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Add Organization</div>
                  <div className="ml-auto bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider shadow-sm">
                    Coming Soon
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/50 tracking-wide mb-1 px-4 mt-2 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive =
                    item.url === "/"
                      ? pathname === "/"
                      : item.url === "/settings"
                        ? pathname === "/settings"
                        : pathname?.startsWith(item.url);

                  if (item.subItems) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                              tooltip={item.title}
                              isActive={isActive}
                              className={`[[data-state=expanded]_&]:hidden rounded-lg transition-all duration-200 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
                            >
                              <item.icon />
                              <span>{item.title}</span>
                              <ChevronUp className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:-rotate-180" />
                            </SidebarMenuButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side="right"
                            align="start"
                            className="w-48 ml-2 rounded-lg"
                          >
                            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {item.subItems.map((subItem) => (
                              <DropdownMenuItem key={subItem.title} asChild>
                                <Link href={subItem.url} className="w-full cursor-pointer">
                                  {subItem.title}
                                </Link>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Collapsible
                          asChild
                          defaultOpen={isActive}
                          className="group/collapsible absolute inset-0 -z-10 opacity-0 group-data-[collapsible=icon]:hidden [[data-state=expanded]_&]:relative [[data-state=expanded]_&]:z-0 [[data-state=expanded]_&]:opacity-100"
                        >
                          <div>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                tooltip={item.title}
                                isActive={isActive}
                                className={`rounded-lg transition-all duration-200 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
                              >
                                <item.icon />
                                <span>{item.title}</span>
                                <ChevronUp className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:-rotate-180" />
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.subItems.map((subItem) => {
                                  const isSubActive = pathname === subItem.url;
                                  return (
                                    <SidebarMenuSubItem key={subItem.title}>
                                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                                        <Link href={subItem.url}>
                                          <span>{subItem.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      </SidebarMenuItem>
                    );
                  }

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
        ))}
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
                  <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
                    System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-lg transition-all duration-200"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user?.image || ""}
                      alt={user?.name || ""}
                    />
                    <AvatarFallback className="rounded-lg">
                      {user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.name || "User"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {user?.email || "user@example.com"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user?.image || ""}
                        alt={user?.name || ""}
                      />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                        {user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name || "User"}
                      </span>
                      <span className="truncate text-xs">
                        {user?.email || "user@example.com"}
                      </span>
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
                    <button
                      type="submit"
                      className="w-full text-left flex items-center cursor-pointer"
                    >
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
