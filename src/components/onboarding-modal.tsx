"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { companyProfileSchema, bankDetailsSchema, integrationsSchema, CompanyProfileFormValues, BankDetailsFormValues, IntegrationsFormValues } from "@/lib/validations/settings";
import { CompanyProfileFields } from "@/components/forms/company-profile-fields";
import { BankDetailsFields } from "@/components/forms/bank-details-fields";
import { IntegrationsFields } from "@/components/forms/integrations-fields";
import { NumericFormat } from "react-number-format";
import {
  onboardingClientSchema,
  onboardingProjectSchema,
  OnboardingClientValues,
  OnboardingProjectValues
} from "@/lib/validations/onboarding";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Building2,
  Landmark,
  Link2,
  Users,
  FolderKanban,
  PartyPopper,
  Rocket,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Check
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingsData = {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  senderEmail: string;
  companyLogoUrl: string;
  companyWhatsApp: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  resendApiKey: string;
  mayarApiKey: string;
  mayarWebhookSecret: string;
};

type Props = {
  isOpen: boolean;
  userName: string;
  existingSettings?: SettingsData;
  existingClients: { id: string; name: string }[];
};

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Rocket, required: true },
  { id: "company", title: "Company Profile", icon: Building2, required: true },
  { id: "bank", title: "Bank", icon: Landmark, required: false },
  { id: "integrations", title: "Integrations", icon: Link2, required: false },
  { id: "client", title: "Client", icon: Users, required: false },
  { id: "project", title: "Project", icon: FolderKanban, required: false },
  { id: "complete", title: "Done", icon: PartyPopper, required: true },
];

export function OnboardingModal({ isOpen: initialIsOpen, userName, existingSettings, existingClients }: Props): React.ReactNode {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Allow closing the modal ONLY via explicit completion to prevent accidental dismissal
  const handleOpenChange = (open: boolean) => {
    // If attempting to close without finishing, do nothing
    if (!open && isOpen) return;
    setIsOpen(open);
  };

  // Form Setup
  const companyForm = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      companyName: existingSettings?.companyName || "",
      companyAddress: existingSettings?.companyAddress || "",
      companyEmail: existingSettings?.companyEmail || "",
      senderEmail: existingSettings?.senderEmail || "",
      companyLogoUrl: existingSettings?.companyLogoUrl || "",
      companyWhatsApp: existingSettings?.companyWhatsApp || "",
    }
  });

  const bankForm = useForm<BankDetailsFormValues>({
    resolver: zodResolver(bankDetailsSchema),
    defaultValues: {
      bankName: existingSettings?.bankName || "",
      bankAccountName: existingSettings?.bankAccountName || "",
      bankAccountNumber: existingSettings?.bankAccountNumber || "",
    }
  });

  const integrationsForm = useForm<IntegrationsFormValues>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: {
      resendApiKey: existingSettings?.resendApiKey || "",
      mayarApiKey: existingSettings?.mayarApiKey || "",
      mayarWebhookSecret: existingSettings?.mayarWebhookSecret || "",
    }
  });

  // Client state
  const clientForm = useForm<OnboardingClientValues>({
    resolver: zodResolver(onboardingClientSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
    }
  });

  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [allClients, setAllClients] = useState(existingClients);

  // Project state
  const projectForm = useForm<OnboardingProjectValues>({
    resolver: zodResolver(onboardingProjectSchema),
    defaultValues: {
      projectTitle: "",
      projectPrice: "",
      projectClientId: "",
    }
  });

  const [projectCreated, setProjectCreated] = useState(false);

  const step = STEPS[currentStep];
  const progress = Math.round(((currentStep) / (STEPS.length - 1)) * 100);

  // ─── Save handlers ──────────────────────────────────────────────────

  const saveSettings = async (fields: Record<string, string>) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Saved successfully!");
      return true;
    } catch {
      toast.error("Failed to save. Please try again.");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextCompany = async (values: CompanyProfileFormValues) => {
    const ok = await saveSettings(values as Record<string, string>);
    if (ok) setCurrentStep((s) => s + 1);
  };

  const handleNextBank = async (values: BankDetailsFormValues) => {
    // Only pass non-empty strings, ignore undefined
    const payload: Record<string, string> = {};
    if (values.bankName) payload.bankName = values.bankName;
    if (values.bankAccountName) payload.bankAccountName = values.bankAccountName;
    if (values.bankAccountNumber) payload.bankAccountNumber = values.bankAccountNumber;

    const ok = await saveSettings(payload);
    if (ok) setCurrentStep((s) => s + 1);
  };

  const handleNextIntegrations = async (values: IntegrationsFormValues) => {
    // Only pass non-empty strings, ignore undefined
    const payload: Record<string, string> = {};
    if (values.resendApiKey) payload.resendApiKey = values.resendApiKey;
    if (values.mayarApiKey) payload.mayarApiKey = values.mayarApiKey;
    if (values.mayarWebhookSecret) payload.mayarWebhookSecret = values.mayarWebhookSecret;

    const ok = await saveSettings(payload);
    if (ok) setCurrentStep((s) => s + 1);
  };

  const handleCreateClient = async (values: OnboardingClientValues) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.clientName,
          email: values.clientEmail || null,
          phone: values.clientPhone || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create client");
      const client = await res.json();
      setCreatedClientId(client.id);
      setAllClients((prev) => [{ id: client.id, name: client.name }, ...prev]);
      projectForm.setValue("projectClientId", client.id);
      toast.success(`Client "${client.name}" created!`);
      setCurrentStep((s) => s + 1);
    } catch {
      toast.error("Failed to create client. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (values: OnboardingProjectValues) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: values.projectClientId,
          title: values.projectTitle,
          totalPrice: Number(values.projectPrice),
          items: [{ description: values.projectTitle, price: Number(values.projectPrice) }],
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      setProjectCreated(true);
      toast.success("Project created!");
      setCurrentStep((s) => s + 1);
    } catch {
      toast.error("Failed to create project. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/users/onboarding-complete", { method: "PUT" });
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));
  const skip = () => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1));

  const canShowProjectStep = allClients.length > 0 || createdClientId;

  // ─── Step Renderers ─────────────────────────────────────────────────

  const renderStepContent = () => {
    switch (step.id) {
      case "welcome":
        return (
          <div className="text-center space-y-4 sm:space-y-6 py-6 sm:py-8">
            <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 animate-in zoom-in-50 duration-500">
              <Rocket className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div className="space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome, {userName}! 👋
              </h2>
              <p className="text-muted-foreground text-sm sm:text-lg max-w-md mx-auto px-4">
                Let&apos;s get ProjectBill set up for your business. This will only take a few minutes.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 max-w-lg mx-auto pt-2 sm:pt-4 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-300 px-4">
              <div className="flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-2 p-3 sm:p-4 rounded-xl bg-muted/50 text-left sm:text-center transition-all hover:bg-muted duration-200">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-500 shrink-0" />
                <span className="text-sm font-medium">Set up profile</span>
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-2 p-3 sm:p-4 rounded-xl bg-muted/50 text-left sm:text-center transition-all hover:bg-muted duration-200">
                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" />
                <span className="text-sm font-medium">Add clients</span>
              </div>
              <div className="flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-2 p-3 sm:p-4 rounded-xl bg-muted/50 text-left sm:text-center transition-all hover:bg-muted duration-200">
                <FolderKanban className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 shrink-0" />
                <span className="text-sm font-medium">Create projects</span>
              </div>
            </div>
          </div>
        );

      case "company":
        return (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Company Profile
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                This info appears on your invoices and reports.
              </p>
              <Form {...companyForm}>
                <form id="company-form" onSubmit={companyForm.handleSubmit(handleNextCompany)} className="space-y-4">
                  <CompanyProfileFields form={companyForm} />
                </form>
              </Form>
            </div>
          </div>
        );

      case "bank":
        return (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Landmark className="w-5 h-5 text-amber-500" />
                Bank Details
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Used as a manual payment option on invoices.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
              💡 Recommended — Provides a fallback payment method for your clients.
            </div>
            <Form {...bankForm}>
              <form id="bank-form" onSubmit={bankForm.handleSubmit(handleNextBank)} className="space-y-4">
                <BankDetailsFields form={bankForm} />
              </form>
            </Form>
          </div>
        );

      case "integrations":
        return (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Link2 className="w-5 h-5 text-purple-500" />
                Integrations
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Connect your payment gateway and email delivery service.
              </p>
            </div>
            <Form {...integrationsForm}>
              <form id="integrations-form" onSubmit={integrationsForm.handleSubmit(handleNextIntegrations)} className="space-y-4">
                <IntegrationsFields form={integrationsForm} />
              </form>
            </Form>
          </div>
        );

      case "client":
        return (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-500" />
                Your First Client
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Who will you be working with? You can always add more later.
              </p>
            </div>
            {createdClientId ? (
              <div className="text-center py-6 space-y-3 border rounded-xl bg-emerald-50/30 dark:bg-emerald-950/10">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-base font-medium">Client Created!</p>
                  <p className="text-sm text-muted-foreground">{clientForm.getValues("clientName")}</p>
                </div>
              </div>
            ) : (
              <Form {...clientForm}>
                <form id="client-form" onSubmit={clientForm.handleSubmit(handleCreateClient)} className="space-y-4">
                  <FormField
                    control={clientForm.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter client name"
                            className="bg-slate-50 dark:bg-slate-900"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={clientForm.control}
                      name="clientEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="contact@acme.com"
                              className="bg-slate-50 dark:bg-slate-900"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={clientForm.control}
                      name="clientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="081234567890"
                              className="bg-slate-50 dark:bg-slate-900"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            )}
          </div>
        );

      case "project":
        return (
          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-amber-500" />
                Your First Project
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Let&apos;s create a project to start tracking your work.
              </p>
            </div>
            {projectCreated ? (
              <div className="text-center py-6 space-y-3 border rounded-xl bg-amber-50/30 dark:bg-amber-950/10">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Check className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-base font-medium">Project Created!</p>
                  <p className="text-sm text-muted-foreground">{projectForm.getValues("projectTitle")}</p>
                </div>
              </div>
            ) : (
              <Form {...projectForm}>
                <form id="project-form" onSubmit={projectForm.handleSubmit(handleCreateProject)} className="space-y-4">
                  {allClients.length > 0 && (
                    <FormField
                      control={projectForm.control}
                      name="projectClientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Client <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-50 dark:bg-slate-900">
                                <SelectValue placeholder="Choose..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allClients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={projectForm.control}
                    name="projectTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Title <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Website Redesign"
                            className="bg-slate-50 dark:bg-slate-900"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={projectForm.control}
                    name="projectPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Price <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <NumericFormat
                            value={field.value}
                            onValueChange={(values) => field.onChange(values.value)}
                            placeholder="Enter Total Price"
                            thousandSeparator="."
                            decimalSeparator=","
                            prefix="Rp "
                            className="flex h-9 w-full rounded-md border border-input bg-slate-50 dark:bg-slate-900 font-mono px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="text-center space-y-6 py-6 sm:py-8">
            <div className="mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 animate-in zoom-in-50 duration-500">
              <PartyPopper className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
            </div>
            <div className="space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                You&apos;re all set! 🎉
              </h2>
              <p className="text-muted-foreground text-sm sm:text-lg max-w-md mx-auto">
                ProjectBill is ready. You can now close this wizard and start managing your workspace.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Navigation Buttons ─────────────────────────────────────────────

  const renderNavButtons = () => {
    if (step.id === "welcome") {
      return (
        <div className="flex justify-end">
          <Button onClick={() => setCurrentStep(1)} size="lg" className="gap-2 w-full sm:w-auto">
            Let&apos;s Go <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    if (step.id === "complete") {
      return (
        <div className="flex justify-center">
          <Button onClick={handleComplete} size="lg" disabled={isLoading} className="gap-2 px-8 w-full sm:w-auto">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Finishing...</>
            ) : (
              <>Go to Dashboard <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      );
    }

    // Determine the primary action
    let primaryAction: () => void = () => setCurrentStep((s) => s + 1);
    let primaryLabel = "Next";

    switch (step.id) {
      case "company":
        primaryAction = companyForm.handleSubmit(handleNextCompany);
        primaryLabel = "Save";
        break;
      case "bank":
        primaryAction = bankForm.handleSubmit(handleNextBank);
        primaryLabel = "Save";
        break;
      case "integrations":
        primaryAction = integrationsForm.handleSubmit(handleNextIntegrations);
        primaryLabel = "Save";
        break;
      case "client":
        if (createdClientId) {
          primaryAction = () => {
            if (canShowProjectStep) setCurrentStep((s) => s + 1);
            else setCurrentStep(STEPS.length - 1);
          };
          primaryLabel = "Next";
        } else {
          primaryAction = clientForm.handleSubmit(handleCreateClient);
          primaryLabel = "Create";
        }
        break;
      case "project":
        if (projectCreated) {
          primaryAction = () => setCurrentStep(STEPS.length - 1);
          primaryLabel = "Next";
        } else {
          primaryAction = projectForm.handleSubmit(handleCreateProject);
          primaryLabel = "Create";
        }
        break;
    }

    return (
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
        <Button variant="ghost" onClick={goBack} disabled={isLoading} className="gap-1 w-full sm:w-auto">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2 w-full sm:w-auto">
          {!step.required && (
            <Button
              variant="outline"
              onClick={() => {
                if (step.id === "project" || (step.id === "client" && !canShowProjectStep)) {
                  setCurrentStep(STEPS.length - 1);
                } else if (step.id === "client" && !canShowProjectStep) {
                  setCurrentStep(STEPS.length - 1);
                } else {
                  skip();
                }
              }}
              disabled={isLoading}
              className="gap-1 flex-1 sm:flex-none"
            >
              <SkipForward className="w-4 h-4" /> Skip
            </Button>
          )}
          <Button onClick={primaryAction} disabled={isLoading} className="gap-2 flex-1 sm:flex-none">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <>{primaryLabel} <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[600px] w-[95vw] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header / Stepper section (Fixed at top) */}
        <div className="bg-muted/30 px-4 py-3 sm:px-6 sm:py-3 border-b shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">Setup Assistant</DialogTitle>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Compact Step Indicators */}
          <div className="flex items-center justify-between hidden sm:flex pt-1 pb-1 overflow-x-auto hide-scrollbar">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isDone = i < currentStep;
              const isCurrent = i === currentStep;
              return (
                <div key={s.id} className="flex items-center shrink-0 px-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${isDone
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
                      : isCurrent
                        ? "bg-primary text-primary-foreground shadow-sm scale-110"
                        : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            {renderStepContent()}
          </div>
        </ScrollArea>

        {/* Footer Navigation (Fixed at bottom) */}
        <div className="p-4 sm:py-4 sm:px-6 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
          {renderNavButtons()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
