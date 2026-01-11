import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import {
  Plus,
  Target,
  Calendar,
  User,
  TrendingUp,
  Edit,
  Trash2,
} from "lucide-react";

export default function GoalsOKRs() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("my");
  const [selectedQuarter, setSelectedQuarter] = useState("q1-2025");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [keyResults, setKeyResults] = useState([{ title: "", target: "" }]);

  // Mock current user
  const currentUser = { id: "1", name: "Sarah Johnson" };

  const [formData, setFormData] = useState({
    objective: "",
    owner: "",
    quarter: "",
  });

  // Mock data
  const quarters = [
    { id: "q1-2025", name: "Q1 2025" },
    { id: "q4-2024", name: "Q4 2024" },
    { id: "q3-2024", name: "Q3 2024" },
    { id: "q2-2024", name: "Q2 2024" },
  ];

  const teamMembers = [
    { id: "1", name: "Sarah Johnson", avatar: "SJ" },
    { id: "2", name: "Michael Chen", avatar: "MC" },
    { id: "3", name: "Emily Rodriguez", avatar: "ER" },
    { id: "4", name: "James Miller", avatar: "JM" },
    { id: "5", name: "Jennifer Brown", avatar: "JB" },
  ];

  // Mock OKRs data
  const okrs = [
    {
      id: 1,
      objective: "Improve customer satisfaction and reduce churn",
      ownerId: "1",
      ownerName: "Sarah Johnson",
      ownerAvatar: "SJ",
      quarter: "Q1 2025",
      progress: 75,
      status: "On Track",
      keyResults: [
        {
          title: "Increase NPS score to 8.5",
          target: "8.5",
          current: "8.2",
          progress: 85,
        },
        {
          title: "Reduce churn rate to below 5%",
          target: "5%",
          current: "6.2%",
          progress: 60,
        },
        {
          title: "Implement customer feedback system",
          target: "100%",
          current: "80%",
          progress: 80,
        },
      ],
    },
    {
      id: 2,
      objective: "Scale engineering team and improve development velocity",
      ownerId: "2",
      ownerName: "Michael Chen",
      ownerAvatar: "MC",
      quarter: "Q1 2025",
      progress: 60,
      status: "At Risk",
      keyResults: [
        {
          title: "Hire 5 senior engineers",
          target: "5",
          current: "2",
          progress: 40,
        },
        {
          title: "Reduce deployment time to 15 minutes",
          target: "15 min",
          current: "25 min",
          progress: 60,
        },
        {
          title: "Achieve 95% code test coverage",
          target: "95%",
          current: "88%",
          progress: 80,
        },
      ],
    },
    {
      id: 3,
      objective: "Expand market presence in North America",
      ownerId: "3",
      ownerName: "Emily Rodriguez",
      ownerAvatar: "ER",
      quarter: "Q1 2025",
      progress: 90,
      status: "Completed",
      keyResults: [
        {
          title: "Launch in 10 new cities",
          target: "10",
          current: "12",
          progress: 100,
        },
        {
          title: "Acquire 50 enterprise clients",
          target: "50",
          current: "48",
          progress: 96,
        },
        {
          title: "Generate $2M in revenue",
          target: "$2M",
          current: "$1.8M",
          progress: 90,
        },
      ],
    },
    {
      id: 4,
      objective: "Enhance product features and user experience",
      ownerId: "1",
      ownerName: "Sarah Johnson",
      ownerAvatar: "SJ",
      quarter: "Q4 2024",
      progress: 85,
      status: "Completed",
      keyResults: [
        {
          title: "Ship mobile app v2.0",
          target: "100%",
          current: "100%",
          progress: 100,
        },
        {
          title: "Reduce page load time by 50%",
          target: "50%",
          current: "45%",
          progress: 90,
        },
        {
          title: "Implement dark mode",
          target: "100%",
          current: "60%",
          progress: 60,
        },
      ],
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "On Track":
        return <Badge className="bg-green-100 text-green-800">On Track</Badge>;
      case "At Risk":
        return <Badge className="bg-yellow-100 text-yellow-800">At Risk</Badge>;
      case "Completed":
        return <Badge className="bg-blue-100 text-blue-800">Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleKeyResultChange = (
    index: number,
    field: string,
    value: string,
  ) => {
    setKeyResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addKeyResult = () => {
    setKeyResults((prev) => [...prev, { title: "", target: "" }]);
  };

  const removeKeyResult = (index: number) => {
    setKeyResults((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.objective || !formData.owner || !formData.quarter) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (keyResults.some((kr) => !kr.title || !kr.target)) {
      toast({
        title: "Validation Error",
        description: "Please complete all key results.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Creating OKR:", { ...formData, keyResults });

      toast({
        title: "Success",
        description: "OKR created successfully.",
      });

      setFormData({
        objective: "",
        owner: "",
        quarter: "",
      });
      setKeyResults([{ title: "", target: "" }]);
      setShowCreateDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create OKR. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getFilteredOKRs = () => {
    let filtered = okrs.filter((okr) => okr.quarter === selectedQuarter);

    if (activeTab === "my") {
      filtered = filtered.filter((okr) => okr.ownerId === currentUser.id);
    }

    return filtered;
  };

  const filteredOKRs = getFilteredOKRs();

  const renderOKRCard = (okr: any) => (
    <Card key={okr.id} className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{okr.objective}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {okr.ownerAvatar}
                  </AvatarFallback>
                </Avatar>
                <span>{okr.ownerName}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{okr.quarter}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(okr.status)}
            <Button size="sm" variant="ghost">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-gray-600">{okr.progress}%</span>
            </div>
            <Progress value={okr.progress} className="h-2" />
          </div>

          <div>
            <h4 className="font-medium mb-3">Key Results</h4>
            <div className="space-y-3">
              {okr.keyResults.map((kr: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{kr.title}</span>
                    <span className="text-sm text-gray-600">
                      {kr.current} / {kr.target}
                    </span>
                  </div>
                  <Progress value={kr.progress} className="h-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />

      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Goals & OKRs
            </h1>
            <p className="text-gray-600">
              Track objectives and key results for personal and team goals
            </p>
          </div>

          {/* Quarter Picker */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Goal Period
                </CardTitle>
                <Dialog
                  open={showCreateDialog}
                  onOpenChange={setShowCreateDialog}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create OKR
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create New OKR</DialogTitle>
                      <DialogDescription>
                        Define objectives and key results for the quarter
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="objective">Objective *</Label>
                        <Input
                          id="objective"
                          value={formData.objective}
                          onChange={(e) =>
                            handleInputChange("objective", e.target.value)
                          }
                          placeholder="Enter your objective..."
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="owner">Owner *</Label>
                        <Select
                          value={formData.owner}
                          onValueChange={(value) =>
                            handleInputChange("owner", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select owner" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quarter">Quarter *</Label>
                        <Select
                          value={formData.quarter}
                          onValueChange={(value) =>
                            handleInputChange("quarter", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select quarter" />
                          </SelectTrigger>
                          <SelectContent>
                            {quarters.map((quarter) => (
                              <SelectItem key={quarter.id} value={quarter.id}>
                                {quarter.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Key Results *</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addKeyResult}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {keyResults.map((kr, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                placeholder="Key result title"
                                value={kr.title}
                                onChange={(e) =>
                                  handleKeyResultChange(
                                    index,
                                    "title",
                                    e.target.value,
                                  )
                                }
                                className="flex-1"
                              />
                              <Input
                                placeholder="Target metric"
                                value={kr.target}
                                onChange={(e) =>
                                  handleKeyResultChange(
                                    index,
                                    "target",
                                    e.target.value,
                                  )
                                }
                                className="w-32"
                              />
                              {keyResults.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeKeyResult(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                          Create OKR
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <Label htmlFor="quarter-select">Quarter/Year</Label>
                  <Select
                    value={selectedQuarter}
                    onValueChange={setSelectedQuarter}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {quarters.map((quarter) => (
                        <SelectItem key={quarter.id} value={quarter.id}>
                          {quarter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-gray-600 mt-6">
                  Showing {filteredOKRs.length} OKRs for{" "}
                  {quarters.find((q) => q.id === selectedQuarter)?.name}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="my">My Goals</TabsTrigger>
              <TabsTrigger value="team">Team Goals</TabsTrigger>
            </TabsList>

            <TabsContent value="my" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredOKRs.map(renderOKRCard)}
                {filteredOKRs.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No OKRs found</h3>
                    <p>Create your first OKR to start tracking your goals.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="team" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredOKRs.map(renderOKRCard)}
                {filteredOKRs.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-gray-500">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      No team OKRs found
                    </h3>
                    <p>No team goals for the selected quarter.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
