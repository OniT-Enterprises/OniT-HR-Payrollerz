/**
 * Announcements - Company announcement management for HR admins
 * Broadcasts messages to all employees via the Ekipa mobile app
 */

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import MainNavigation from "@/components/layout/MainNavigation";
import AutoBreadcrumb from "@/components/AutoBreadcrumb";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { formatDateTL } from "@/lib/dateUtils";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Pin,
  PinOff,
  Eye,
  Image,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  imageUrl?: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  readBy?: Record<string, boolean>;
}

interface AnnouncementFormData {
  title: string;
  body: string;
  pinned: boolean;
  imageUrl: string;
}

const EMPTY_FORM: AnnouncementFormData = {
  title: "",
  body: "",
  pinned: false,
  imageUrl: "",
};

export default function Announcements() {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(EMPTY_FORM);

  const announcementsRef = collection(db, `tenants/${tenantId}/announcements`);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(announcementsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: Announcement[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title || "",
          body: data.body || "",
          pinned: data.pinned || false,
          imageUrl: data.imageUrl || undefined,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : data.createdAt || new Date(),
          createdBy: data.createdBy || "",
          createdByName: data.createdByName || "Unknown",
          readBy: data.readBy || {},
        };
      });
      setAnnouncements(items);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [announcementsRef, toast]);

  useEffect(() => {
    if (tenantId) {
      fetchAnnouncements();
    }
  }, [tenantId, fetchAnnouncements]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingAnnouncement(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      body: announcement.body,
      pinned: announcement.pinned,
      imageUrl: announcement.imageUrl || "",
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!tenantId || saving) return;

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.body.trim()) {
      toast({
        title: "Error",
        description: "Body is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        pinned: formData.pinned,
        imageUrl: formData.imageUrl.trim() || null,
      };

      if (editingAnnouncement) {
        const docRef = doc(db, `tenants/${tenantId}/announcements`, editingAnnouncement.id);
        await updateDoc(docRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: "Success",
          description: "Announcement updated",
        });
      } else {
        await addDoc(announcementsRef, {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || "",
          createdByName: user?.displayName || user?.email || "Admin",
          readBy: {},
        });
        toast({
          title: "Success",
          description: "Announcement published",
        });
      }

      handleCloseDialog();
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error saving announcement:", error);
      toast({
        title: "Error",
        description: editingAnnouncement
          ? "Failed to update announcement"
          : "Failed to create announcement",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tenantId || !deletingAnnouncement) return;

    try {
      const docRef = doc(db, `tenants/${tenantId}/announcements`, deletingAnnouncement.id);
      await deleteDoc(docRef);
      toast({
        title: "Success",
        description: "Announcement deleted",
      });
      setDeletingAnnouncement(null);
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast({
        title: "Error",
        description: "Failed to delete announcement",
        variant: "destructive",
      });
    }
  };

  const handleTogglePin = async (announcement: Announcement) => {
    if (!tenantId) return;

    try {
      const docRef = doc(db, `tenants/${tenantId}/announcements`, announcement.id);
      await updateDoc(docRef, {
        pinned: !announcement.pinned,
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Success",
        description: announcement.pinned ? "Announcement unpinned" : "Announcement pinned to top",
      });
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error toggling pin:", error);
      toast({
        title: "Error",
        description: "Failed to update announcement",
        variant: "destructive",
      });
    }
  };

  const getReadCount = (announcement: Announcement): number => {
    return announcement.readBy ? Object.keys(announcement.readBy).length : 0;
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MainNavigation />
        <div className="p-6 max-w-7xl mx-auto">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Announcements - Meza" description="Manage company announcements for Ekipa" />
      <MainNavigation />

      <div className="p-6 max-w-7xl mx-auto">
        <AutoBreadcrumb className="mb-6" />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Announcements</h1>
              <p className="text-muted-foreground">
                Broadcast messages to all employees via Ekipa
              </p>
            </div>
          </div>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{announcements.length}</p>
                </div>
                <Megaphone className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pinned</p>
                  <p className="text-2xl font-bold">
                    {announcements.filter((a) => a.pinned).length}
                  </p>
                </div>
                <Pin className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Reads</p>
                  <p className="text-2xl font-bold">
                    {announcements.reduce((sum, a) => sum + getReadCount(a), 0)}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Announcements Table */}
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">No announcements yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first announcement to broadcast to all employees via Ekipa.
              </p>
              <Button onClick={openCreateDialog} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                New Announcement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Title</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead className="w-[100px]">Pinned</TableHead>
                  <TableHead className="w-[150px]">Created</TableHead>
                  <TableHead className="w-[100px] text-center">Read Count</TableHead>
                  <TableHead className="w-[180px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {announcement.imageUrl && (
                          <span title="Has image">
                            <Image className="h-4 w-4 text-muted-foreground" />
                          </span>
                        )}
                        {truncateText(announcement.title, 40)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {truncateText(announcement.body, 60)}
                    </TableCell>
                    <TableCell>
                      {announcement.pinned ? (
                        <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Pinned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{formatDateTL(announcement.createdAt, { month: "short", day: "numeric" })}</div>
                      <div className="text-xs">{announcement.createdByName}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{getReadCount(announcement)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePin(announcement)}
                          title={announcement.pinned ? "Unpin" : "Pin to top"}
                        >
                          {announcement.pinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(announcement)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingAnnouncement(announcement)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement
                ? "Update the announcement details below."
                : "This will be visible to all employees in the Ekipa app."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title *</Label>
              <Input
                id="ann-title"
                placeholder="e.g. Holiday Schedule Update"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-body">Body *</Label>
              <Textarea
                id="ann-body"
                placeholder="Write your announcement message..."
                value={formData.body}
                onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                rows={5}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.body.length}/2000
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-image">Image URL (optional)</Label>
              <Input
                id="ann-image"
                placeholder="https://example.com/image.jpg"
                value={formData.imageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ann-pinned"
                checked={formData.pinned}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, pinned: checked === true }))
                }
              />
              <Label htmlFor="ann-pinned" className="text-sm font-normal cursor-pointer">
                Pin to top of announcements feed
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving
                ? "Saving..."
                : editingAnnouncement
                  ? "Update"
                  : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingAnnouncement}
        onOpenChange={(open) => { if (!open) setDeletingAnnouncement(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingAnnouncement?.title}&quot;? This action
              cannot be undone and the announcement will be removed from all employees&apos; Ekipa feeds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
