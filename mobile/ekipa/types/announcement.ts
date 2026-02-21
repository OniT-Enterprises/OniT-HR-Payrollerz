export interface Announcement {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  imageUrl?: string;
  pinned: boolean;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  readBy?: Record<string, Date>;
}
