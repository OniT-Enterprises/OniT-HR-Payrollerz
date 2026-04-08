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
import PageHeader from "@/components/layout/PageHeader";
import { useTenantId } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { formatDateTL } from "@/lib/dateUtils";
import { useI18n } from "@/i18n/I18nProvider";
import MoreDetailsSection from "@/components/MoreDetailsSection";
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
  const { t } = useI18n();
  const tenantId = useTenantId();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<Announcement | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(EMPTY_FORM);

  const fetchAnnouncements = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const ref = collection(db, `tenants/${tenantId}/announcements`);
      const q = query(ref, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: Announcement[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          title: data.title || "",
          body: data.body || "",
          pinned: data.pinned || false,
          imageUrl: data.imageUrl || "",
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : data.createdAt || new Date(),
          createdBy: data.createdBy || "",
          createdByName: data.createdByName || t("common.unknown"),
          readBy: data.readBy || {},
        };
      });
      setAnnouncements(items);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast({
        title: t("common.error"),
        description: t("announcements.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, t, toast]);

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
        title: t("announcements.toast.validationTitle"),
        description: t("announcements.toast.titleRequired"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.body.trim()) {
      toast({
        title: t("announcements.toast.validationTitle"),
        description: t("announcements.toast.bodyRequired"),
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
          title: t("common.success"),
          description: t("announcements.toast.updated"),
        });
      } else {
        await addDoc(collection(db, `tenants/${tenantId}/announcements`), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || "",
          createdByName: user?.displayName || user?.email || t("announcements.createdByFallback"),
          readBy: {},
        });
        toast({
          title: t("common.success"),
          description: t("announcements.toast.published"),
        });
      }

      handleCloseDialog();
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error saving announcement:", error);
      toast({
        title: t("common.error"),
        description: editingAnnouncement
          ? t("announcements.toast.updateFailed")
          : t("announcements.toast.createFailed"),
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
        title: t("common.success"),
        description: t("announcements.toast.deleted"),
      });
      setDeletingAnnouncement(null);
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast({
        title: t("common.error"),
        description: t("announcements.toast.deleteFailed"),
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
        title: t("common.success"),
        description: announcement.pinned
          ? t("announcements.toast.unpinned")
          : t("announcements.toast.pinned"),
      });
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error toggling pin:", error);
      toast({
        title: t("common.error"),
        description: t("announcements.toast.pinFailed"),
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
        <div className="p-6 mx-auto max-w-screen-2xl">
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
      <SEO title={`${t("announcements.title")} - Meza`} description={t("announcements.subtitle")} />
      <MainNavigation />

      <div className="p-6 mx-auto max-w-screen-2xl">
        <PageHeader
          title={t("announcements.title")}
          subtitle={t("announcements.subtitle")}
          icon={Megaphone}
          iconColor="text-blue-500"
          actions={
            <Button onClick={openCreateDialog} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600" size="lg">
              <Plus className="h-5 w-5 mr-2" />
              {t("announcements.new")}
            </Button>
          }
        />

        {/* Announcements Table */}
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-1">{t("announcements.empty.title")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("announcements.empty.description")}
              </p>
              <Button onClick={openCreateDialog} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                {t("announcements.new")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {announcements.map((announcement) => (
                <Card key={announcement.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{truncateText(announcement.title, 60)}</p>
                          {announcement.imageUrl && (
                            <span title={t("announcements.table.hasImage")}>
                              <Image className="h-4 w-4 text-muted-foreground" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {truncateText(announcement.body, 120)}
                        </p>
                      </div>
                      {announcement.pinned ? (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {t("announcements.table.pinnedYes")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDateTL(announcement.createdAt, { month: "short", day: "numeric" })}</span>
                      <span>{announcement.createdByName}</span>
                      <span>{t("announcements.table.readCount")}: {getReadCount(announcement)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleTogglePin(announcement)}>
                        {announcement.pinned ? (
                          <PinOff className="h-4 w-4 mr-1.5" />
                        ) : (
                          <Pin className="h-4 w-4 mr-1.5" />
                        )}
                        {announcement.pinned ? t("announcements.actions.unpin") : t("announcements.actions.pin")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(announcement)}>
                        <Edit className="h-4 w-4 mr-1.5" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingAnnouncement(announcement)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        {t("common.delete")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">{t("announcements.table.title")}</TableHead>
                    <TableHead>{t("announcements.table.body")}</TableHead>
                    <TableHead className="w-[100px]">{t("announcements.table.pinned")}</TableHead>
                    <TableHead className="w-[150px]">{t("announcements.table.created")}</TableHead>
                    <TableHead className="w-[120px] text-center">{t("announcements.table.readCount")}</TableHead>
                    <TableHead className="w-[280px] text-right">{t("announcements.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {announcement.imageUrl && (
                            <span title={t("announcements.table.hasImage")}>
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
                          <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {t("announcements.table.pinnedYes")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t("announcements.table.pinnedNo")}
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
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleTogglePin(announcement)}>
                            {announcement.pinned ? (
                              <PinOff className="h-4 w-4 mr-1.5" />
                            ) : (
                              <Pin className="h-4 w-4 mr-1.5" />
                            )}
                            {announcement.pinned ? t("announcements.actions.unpin") : t("announcements.actions.pin")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(announcement)}>
                            <Edit className="h-4 w-4 mr-1.5" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingAnnouncement(announcement)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            {t("common.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? t("announcements.dialog.editTitle") : t("announcements.dialog.newTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement
                ? t("announcements.dialog.editDescription")
                : t("announcements.dialog.newDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">{t("announcements.dialog.titleLabel")}</Label>
              <Input
                id="ann-title"
                placeholder={t("announcements.dialog.titlePlaceholder")}
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ann-body">{t("announcements.dialog.bodyLabel")}</Label>
              <Textarea
                id="ann-body"
                placeholder={t("announcements.dialog.bodyPlaceholder")}
                value={formData.body}
                onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                rows={5}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {formData.body.length}/2000
              </p>
            </div>

            <MoreDetailsSection>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ann-image">{t("announcements.dialog.imageLabel")}</Label>
                  <Input
                    id="ann-image"
                    placeholder={t("announcements.dialog.imagePlaceholder")}
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
                    {t("announcements.dialog.pinLabel")}
                  </Label>
                </div>
              </div>
            </MoreDetailsSection>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving
                ? t("common.saving")
                : editingAnnouncement
                  ? t("announcements.actions.update")
                  : t("announcements.actions.publish")}
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
            <AlertDialogTitle>{t("announcements.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("announcements.delete.description", { title: deletingAnnouncement?.title || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
