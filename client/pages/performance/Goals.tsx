import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Pause, Pencil, Play, Plus, Target, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/layout/PageHeader";
import { SEO, seoConfig } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantId } from "@/contexts/TenantContext";
import { useDepartments } from "@/hooks/useDepartments";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
  useUpdateMilestone,
} from "@/hooks/usePerformance";
import type { Goal, GoalPriority, Milestone } from "@/services/goalsService";
import { formatDateTL, getTodayTL } from "@/lib/dateUtils";

interface GoalForm {
  title: string;
  description: string;
  department: string;
  priority: GoalPriority;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

function milestoneId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function blankMilestone(): Milestone {
  return { id: milestoneId(), title: "", dueDate: "", status: "pending" };
}

function emptyForm(): GoalForm {
  const today = getTodayTL();
  return {
    title: "",
    description: "",
    department: "",
    priority: "medium",
    startDate: today,
    endDate: today,
    milestones: [blankMilestone()],
  };
}

const statusStyle: Record<Goal["status"], string> = {
  active: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  paused: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
};

export default function Goals() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { toast } = useToast();
  const goalsQuery = useGoals();
  const departmentsQuery = useDepartments(tenantId);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const updateMilestone = useUpdateMilestone();
  const deleteGoal = useDeleteGoal();

  const goals = goalsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(emptyForm);
  const [busyMilestone, setBusyMilestone] = useState<string | null>(null);
  const saving = createGoal.isPending || updateGoal.isPending;

  const openGoal = (goal?: Goal) => {
    setEditingGoal(goal ?? null);
    setForm(
      goal
        ? {
            title: goal.title,
            description: goal.description,
            department: goal.department,
            priority: goal.priority,
            startDate: goal.startDate,
            endDate: goal.endDate,
            milestones: goal.milestones.map((milestone) => ({ ...milestone })),
          }
        : emptyForm(),
    );
    setDialogOpen(true);
  };

  const updateFormMilestone = (id: string, updates: Partial<Milestone>) => {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.map((milestone) =>
        milestone.id === id ? { ...milestone, ...updates } : milestone,
      ),
    }));
  };

  const save = async () => {
    const milestones = form.milestones.map((milestone) => ({
      ...milestone,
      title: milestone.title.trim(),
    }));
    if (!form.title.trim() || !form.department || !form.startDate || !form.endDate) {
      toast({ title: "Complete the goal details", variant: "destructive" });
      return;
    }
    if (form.endDate < form.startDate) {
      toast({ title: "End date must be on or after the start date", variant: "destructive" });
      return;
    }
    if (
      milestones.length === 0 ||
      milestones.some((milestone) => !milestone.title || !milestone.dueDate)
    ) {
      toast({
        title: "Add at least one complete milestone",
        description: "Each milestone needs a short name and due date.",
        variant: "destructive",
      });
      return;
    }
    if (
      milestones.some(
        (milestone) =>
          milestone.dueDate < form.startDate || milestone.dueDate > form.endDate,
      )
    ) {
      toast({
        title: "Milestone dates must fall inside the goal dates",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingGoal?.id) {
        await updateGoal.mutateAsync({
          id: editingGoal.id,
          updates: {
            title: form.title.trim(),
            description: form.description.trim(),
            department: form.department,
            priority: form.priority,
            startDate: form.startDate,
            endDate: form.endDate,
            milestones,
          },
        });
      } else {
        if (!user?.uid) throw new Error("A signed-in user is required.");
        await createGoal.mutateAsync({
          title: form.title.trim(),
          description: form.description.trim(),
          department: form.department,
          priority: form.priority,
          startDate: form.startDate,
          endDate: form.endDate,
          milestones,
          createdById: user.uid,
          createdByName: user.displayName || user.email || "HR",
          assignedTeams: [],
          linkedOKRs: [],
        });
      }
      setDialogOpen(false);
      toast({ title: editingGoal ? "Goal updated" : "Goal created" });
    } catch (error) {
      toast({
        title: "Could not save the goal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleMilestone = async (goal: Goal, milestone: Milestone) => {
    if (!goal.id) return;
    const key = `${goal.id}:${milestone.id}`;
    setBusyMilestone(key);
    try {
      await updateMilestone.mutateAsync({
        goalId: goal.id,
        milestoneId: milestone.id,
        status: milestone.status === "completed" ? "pending" : "completed",
      });
    } catch (error) {
      toast({
        title: "Could not update the milestone",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyMilestone(null);
    }
  };

  const togglePaused = async (goal: Goal) => {
    if (!goal.id) return;
    try {
      await updateGoal.mutateAsync({
        id: goal.id,
        updates: { status: goal.status === "paused" ? "active" : "paused" },
      });
    } catch (error) {
      toast({
        title: "Could not update the goal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deleteGoal.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      toast({ title: "Goal deleted" });
    } catch (error) {
      toast({
        title: "Could not delete the goal",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO {...seoConfig.goals} />
      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader
          title="Goals"
          subtitle="Set a goal, add the few steps that matter, and tick them off."
          icon={Target}
          iconColor="text-blue-600"
          actions={
            <Button onClick={() => openGoal()} className="gap-2">
              <Plus className="h-4 w-4" />
              New goal
            </Button>
          }
        />

        {goalsQuery.isLoading || departmentsQuery.isLoading ? (
          <div className="space-y-4">
            {[0, 1].map((item) => (
              <Card key={item}>
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-full max-w-xl" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : goalsQuery.isError || departmentsQuery.isError ? (
          <Card className="border-destructive/30">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">Could not load all goal data.</p>
              <Button
                variant="outline"
                onClick={() => {
                  void goalsQuery.refetch();
                  void departmentsQuery.refetch();
                }}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : goals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <Target className="mb-3 h-9 w-9 text-muted-foreground/50" />
              <h2 className="font-semibold">No goals yet</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Start with one outcome and a short milestone checklist.
              </p>
              <Button className="mt-5 gap-2" onClick={() => openGoal()}>
                <Plus className="h-4 w-4" />
                Create a goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <Card key={goal.id} className="border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{goal.title}</CardTitle>
                        <Badge variant="outline" className={statusStyle[goal.status]}>
                          {goal.status}
                        </Badge>
                        <Badge variant="secondary">{goal.priority}</Badge>
                      </div>
                      {goal.description && (
                        <CardDescription className="mt-2">{goal.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {goal.status !== "completed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={goal.status === "paused" ? "Resume goal" : "Pause goal"}
                          onClick={() => void togglePaused(goal)}
                        >
                          {goal.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Edit goal" onClick={() => openGoal(goal)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete goal" onClick={() => setDeleteTarget(goal)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{goal.department}</span>
                    <span>{formatDateTL(goal.startDate)} – {formatDateTL(goal.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={goal.progress} className="h-2 flex-1" />
                    <span className="w-10 text-right text-sm font-medium">{goal.progress}%</span>
                  </div>
                  <div className="space-y-2">
                    {goal.milestones.map((milestone) => {
                      const key = `${goal.id}:${milestone.id}`;
                      return (
                        <label key={milestone.id} className="flex min-h-11 items-start gap-3 rounded-lg border px-3 py-2.5">
                          <Checkbox
                            className="mt-0.5"
                            checked={milestone.status === "completed"}
                            disabled={busyMilestone === key || goal.status === "paused"}
                            onCheckedChange={() => void toggleMilestone(goal, milestone)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={milestone.status === "completed" ? "block text-sm line-through text-muted-foreground" : "block text-sm font-medium"}>
                              {milestone.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              {milestone.status === "completed" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Clock3 className={milestone.status === "overdue" ? "h-3.5 w-3.5 text-destructive" : "h-3.5 w-3.5"} />
                              )}
                              Due {formatDateTL(milestone.dueDate)}
                              {milestone.status === "overdue" && " · overdue"}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit goal" : "New goal"}</DialogTitle>
            <DialogDescription>Keep it short. Milestones drive the progress automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal</Label>
              <Input id="goal-title" value={form.title} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="What should be achieved?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-description">Notes</Label>
              <Textarea id="goal-description" value={form.description} maxLength={1500} rows={3} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional context" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(department) => setForm((current) => ({ ...current, department }))}>
                  <SelectTrigger><SelectValue placeholder="Choose a department" /></SelectTrigger>
                  <SelectContent>
                    {form.department && !departments.some((department) => department.name === form.department) && (
                      <SelectItem value={form.department}>{form.department}</SelectItem>
                    )}
                    {departments.map((department) => <SelectItem key={department.id} value={department.name}>{department.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(priority) => setForm((current) => ({ ...current, priority: priority as GoalPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-start">Start</Label>
                <Input id="goal-start" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-end">End</Label>
                <Input id="goal-end" type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Milestones</Label>
                  <p className="text-xs text-muted-foreground">A few concrete steps are enough.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setForm((current) => ({ ...current, milestones: [...current.milestones, blankMilestone()] }))}>
                  <Plus className="h-4 w-4" /> Add step
                </Button>
              </div>
              {form.milestones.map((milestone) => (
                <div key={milestone.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_10rem_auto]">
                  <Input value={milestone.title} maxLength={160} aria-label="Milestone name" placeholder="Milestone" onChange={(event) => updateFormMilestone(milestone.id, { title: event.target.value })} />
                  <Input type="date" value={milestone.dueDate} min={form.startDate} max={form.endDate} aria-label="Milestone due date" onChange={(event) => updateFormMilestone(milestone.id, { dueDate: event.target.value })} />
                  <Button variant="ghost" size="icon" aria-label="Remove milestone" disabled={form.milestones.length === 1} onClick={() => setForm((current) => ({ ...current, milestones: current.milestones.filter((item) => item.id !== milestone.id) }))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save goal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>This removes the goal and its milestone history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} disabled={deleteGoal.isPending}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
