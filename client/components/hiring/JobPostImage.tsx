/**
 * Job Post Image Generator
 * Renders a 1080×1080 branded social-share image from a job spec.
 * Canvas-based — no server call needed.
 */

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JobPostImageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: {
    title: string;
    department?: string;
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    employmentType?: string;
  };
  companyName?: string;
  logoUrl?: string;
  applyUrl?: string;
}

const BRAND_GREEN = "#6A9C29";
const BRAND_DARK = "#1f2937";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load logo"));
    image.src = url;
  });
}

async function drawJobPost(
  canvas: HTMLCanvasElement,
  params: JobPostImageProps["job"] & { companyName: string; applyUrl: string; logoUrl?: string },
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = 1080;
  canvas.width = size;
  canvas.height = size;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(1, "#f8fafc");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Top accent bar
  ctx.fillStyle = BRAND_GREEN;
  ctx.fillRect(0, 0, size, 20);

  // "WE'RE HIRING" badge
  ctx.fillStyle = BRAND_GREEN;
  ctx.fillRect(80, 100, 380, 60);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Helvetica, Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("WE'RE HIRING", 100, 130);

  if (params.logoUrl) {
    try {
      const logo = await loadImage(params.logoUrl);
      const boxX = size - 320;
      const boxY = 76;
      const boxWidth = 240;
      const boxHeight = 120;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      const scale = Math.min((boxWidth - 32) / logo.width, (boxHeight - 32) / logo.height);
      const drawWidth = logo.width * scale;
      const drawHeight = logo.height * scale;
      const drawX = boxX + (boxWidth - drawWidth) / 2;
      const drawY = boxY + (boxHeight - drawHeight) / 2;
      ctx.drawImage(logo, drawX, drawY, drawWidth, drawHeight);
    } catch {
      // Fall back to text-only branding if logo loading fails.
    }
  }

  // Job title (wrap to 3 lines)
  ctx.fillStyle = BRAND_DARK;
  ctx.font = "bold 88px Helvetica, Arial";
  const titleLines = wrapText(ctx, params.title || "Untitled role", size - 160).slice(0, 3);
  let y = 230;
  titleLines.forEach((line) => {
    ctx.fillText(line, 80, y);
    y += 100;
  });

  // Department / location meta
  y += 20;
  ctx.fillStyle = "#6b7280";
  ctx.font = "38px Helvetica, Arial";
  const metaParts = [params.department, params.location, params.employmentType]
    .filter(Boolean)
    .join(" · ");
  if (metaParts) {
    ctx.fillText(metaParts, 80, y);
    y += 70;
  }

  // Salary pill
  if (params.salaryMin || params.salaryMax) {
    const min = params.salaryMin?.toLocaleString() || "";
    const max = params.salaryMax?.toLocaleString() || "";
    const label = min && max ? `$${min} – $${max} /mo` : `$${min || max} /mo`;
    ctx.fillStyle = "#ecfccb";
    const pillW = ctx.measureText(label).width + 60;
    ctx.fillRect(80, y, pillW, 70);
    ctx.fillStyle = BRAND_GREEN;
    ctx.font = "bold 36px Helvetica, Arial";
    ctx.fillText(label, 110, y + 35);
    y += 110;
  }

  // Footer: company + apply URL
  ctx.fillStyle = BRAND_DARK;
  ctx.font = "bold 42px Helvetica, Arial";
  ctx.fillText(params.companyName, 80, size - 180);

  ctx.fillStyle = "#6b7280";
  ctx.font = "32px Helvetica, Arial";
  ctx.fillText(`Apply: ${params.applyUrl}`, 80, size - 120);

  // Bottom accent bar
  ctx.fillStyle = BRAND_GREEN;
  ctx.fillRect(0, size - 20, size, 20);
}

export function JobPostImage({
  open,
  onOpenChange,
  job,
  companyName = "",
  logoUrl = "",
  applyUrl = "",
}: JobPostImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [company, setCompany] = useState(companyName);
  const [url, setUrl] = useState(applyUrl);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setCompany(companyName);
    setUrl(applyUrl);
  }, [open, companyName, applyUrl]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    void drawJobPost(canvasRef.current, {
      ...job,
      companyName: company || "Your Company",
      applyUrl: url || window.location.origin,
      logoUrl: logoUrl || undefined,
    }).catch(() => undefined);
  }, [open, job, company, url, logoUrl]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      const { downloadBlob } = await import("@/lib/downloadBlob");
      const safeTitle = job.title
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_]/g, "_");
      downloadBlob(blob, `job_${safeTitle || "post"}.png`);
    }, "image/png");
  };

  const handleCopyText = async () => {
    const parts = [
      `We're hiring: ${job.title}`,
      [job.department, job.location, job.employmentType].filter(Boolean).join(" · "),
      job.salaryMin || job.salaryMax
        ? `Salary: $${job.salaryMin?.toLocaleString() ?? ""}${
            job.salaryMin && job.salaryMax ? "–$" : ""
          }${job.salaryMax?.toLocaleString() ?? ""}/mo`
        : "",
      "",
      `Apply: ${url || window.location.origin}`,
      company ? `— ${company}` : "",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      toast({ title: "Copied", description: "Caption copied to clipboard." });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access denied.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Share job post</DialogTitle>
          <DialogDescription>
            Download a 1080×1080 image for Facebook, Instagram, LinkedIn — or copy the caption.
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <canvas
              ref={canvasRef}
              className="w-full rounded-lg border border-border/50 shadow-sm"
              style={{ aspectRatio: "1 / 1" }}
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobpost-company">Company name</Label>
              <Input
                id="jobpost-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Naroman Ltd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobpost-url">Apply URL</Label>
              <Input
                id="jobpost-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
              Tip: paste a short link to the application form (e.g. your candidate portal).
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCopyText} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy caption
          </Button>
          <Button onClick={handleDownload} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="h-4 w-4" />
            Download image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default JobPostImage;
