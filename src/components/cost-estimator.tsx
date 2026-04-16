"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Calculator, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { NumericFormat } from "react-number-format";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface TaskItem {
    id: string;
    name: string;
    hours: number;
}

export function CostEstimator({
    currency,
    onApply,
}: {
    currency: string;
    onApply: (items: { description: string; quantity: string; rate: string; price: string }[]) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [tasks, setTasks] = useState<TaskItem[]>([
        { id: crypto.randomUUID(), name: "Maintenance", hours: 4 },
    ]);
    const [ratePerHour, setRatePerHour] = useState("150000");
    const [riskBuffer, setRiskBuffer] = useState([1.5]); // 1.5x by default
    const [totalEstimated, setTotalEstimated] = useState(0);

    useEffect(() => {
        const totalHours = tasks.reduce((sum, task) => sum + (task.hours || 0), 0);
        const rate = Number(ratePerHour) || 0;
        const buffer = riskBuffer[0];

        const calculated = totalHours * rate * buffer;
        setTotalEstimated(calculated);
    }, [tasks, ratePerHour, riskBuffer]);

    const handleAddTask = () => {
        setTasks([...tasks, { id: crypto.randomUUID(), name: "", hours: 0 }]);
    };

    const handleRemoveTask = (id: string) => {
        setTasks(tasks.filter((t) => t.id !== id));
    };

    const handleTaskChange = (id: string, field: keyof TaskItem, value: any) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 px-2 text-xs" type="button">
                    <Calculator className="h-3 w-3 mr-1" />
                    Estimate
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] p-4 sm:p-6 w-[95vw] rounded-xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        Cost Estimator
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Calculate project cost based on estimated working hours (MH) multiplied by your hourly rate and a safety risk buffer.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1">
                            <div className="col-span-8">Task Category</div>
                            <div className="col-span-3 text-center">Hours</div>
                            <div className="col-span-1"></div>
                        </div>
                        {tasks.map((task) => (
                            <div key={task.id} className="grid grid-cols-12 gap-2 group items-center">
                                <Input
                                    className="col-span-8 h-8 text-xs sm:text-sm"
                                    placeholder="e.g. Design"
                                    value={task.name}
                                    onChange={(e) => handleTaskChange(task.id, "name", e.target.value)}
                                />
                                <Input
                                    type="number"
                                    min="0"
                                    className="col-span-3 h-8 text-xs sm:text-sm text-center px-1"
                                    value={task.hours || ""}
                                    onChange={(e) => handleTaskChange(task.id, "hours", Number(e.target.value))}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="col-span-1 h-8 text-muted-foreground hover:text-red-500 opacity-70 sm:opacity-50 sm:group-hover:opacity-100"
                                    onClick={() => handleRemoveTask(task.id)}
                                    disabled={tasks.length === 1}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={handleAddTask} className="h-8 w-full mt-1 border-dashed text-xs">
                            <Plus className="h-3 w-3 mr-2" /> Add Task
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Base Hourly Rate</Label>
                            <NumericFormat
                                value={ratePerHour}
                                onValueChange={(values) => setRatePerHour(values.value)}
                                allowLeadingZeros={false}
                                allowNegative={false}
                                thousandSeparator="."
                                decimalSeparator=","
                                prefix={`${getCurrencySymbol(currency)} `}
                                customInput={Input}
                                className="h-8 text-xs sm:text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                                <Label className="text-xs">Risk Buffer</Label>
                                <span className="font-semibold text-primary">{riskBuffer[0]}x</span>
                            </div>
                            <div className="pt-2 pb-1 px-1">
                                <Slider
                                    value={riskBuffer}
                                    onValueChange={setRiskBuffer}
                                    max={3}
                                    min={1}
                                    step={0.1}
                                />
                            </div>
                        </div>
                    </div>

                    <Card className="mt-2 border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-none">
                        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <div className="text-xs text-muted-foreground mb-1">Recommended Total Price</div>
                                <div className="text-xl sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatMoney(totalEstimated, currency)}
                                </div>
                            </div>
                            <Button
                                onClick={(e) => {
                                    e.preventDefault();
                                    const generatedItems = tasks.map(task => {
                                        const rate = Number(ratePerHour) || 0;
                                        const finalRate = rate * riskBuffer[0];
                                        const price = (task.hours || 0) * finalRate;
                                        return {
                                            description: task.name || "Task",
                                            quantity: String(task.hours || 1),
                                            rate: String(finalRate),
                                            price: String(price)
                                        };
                                    });
                                    onApply(generatedItems);
                                    setIsOpen(false);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                                size="sm"
                                disabled={totalEstimated <= 0}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Apply Value
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </DialogContent>
        </Dialog>
    );
}
