"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

const settingsSchema = z.object({
    companyName: z.string().min(2, "Company Name must be at least 2 characters."),
    companyAddress: z.string().optional(),
    companyEmail: z.string().email("Invalid email address").or(z.literal("")).optional(),
})

export default function SettingsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const form = useForm<z.infer<typeof settingsSchema>>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            companyName: "ProjectBill Consulting",
            companyAddress: "",
            companyEmail: "",
        },
    })

    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/settings')
                if (!res.ok) throw new Error("Failed to fetch settings")
                const data = await res.json()

                form.reset({
                    companyName: data.companyName || "",
                    companyAddress: data.companyAddress || "",
                    companyEmail: data.companyEmail || "",
                })
            } catch (error) {
                console.error("Error loading settings:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    async function onSubmit(values: z.infer<typeof settingsSchema>) {
        setIsSaving(true)
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })
            if (!res.ok) throw new Error("Failed to update settings")
            alert("Settings updated successfully!")
        } catch (error) {
            console.error(error)
            alert("Failed to save settings.")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
    }

    return (
        <div className="flex flex-col gap-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground mt-2">Manage your company branding and billing information.</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 bg-zinc-50 border p-6 rounded-lg dark:bg-zinc-950">

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">General Information</h3>
                        <FormField
                            control={form.control}
                            name="companyName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Acme Corp" {...field} />
                                    </FormControl>
                                    <FormDescription>This will appear on your invoices.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="companyEmail"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Support / Contact Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="hello@acme.com" type="email" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="companyAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company Address</FormLabel>
                                    <FormControl>
                                        <Input placeholder="123 Startup Ave, San Francisco, CA" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Settings
                    </Button>
                </form>
            </Form>
        </div>
    )
}
