/**
 * FaceRegistration — Admin enrollment dialog for face recognition
 * Captures 3 photos with angle prompts, uploads to Storage, saves embeddings
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Check, RefreshCw, Loader2, X } from 'lucide-react';
import FaceCamera from './FaceCamera';
import { useRegisterFace } from '@/hooks/useFaceRecognition';
import { faceRecognitionService } from '@/services/faceRecognitionService';
import { employeeService, type Employee } from '@/services/employeeService';
import { useTenantId } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';

const REQUIRED_PHOTOS = 3;
const PROMPTS = [
  'Look straight at the camera',
  'Turn head slightly to the left',
  'Turn head slightly to the right',
];

interface FaceRegistrationProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface CapturedPhoto {
  blob: Blob;
  descriptor: Float32Array;
  url: string; // object URL for preview
}

export default function FaceRegistration({
  employee,
  open,
  onOpenChange,
  onSuccess,
}: FaceRegistrationProps) {
  const { toast } = useToast();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const registerFace = useRegisterFace();

  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);

  const employeeName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
  const currentStep = photos.length;
  const allCaptured = photos.length >= REQUIRED_PHOTOS;

  const handleCapture = useCallback((blob: Blob, descriptor: Float32Array) => {
    if (photos.length >= REQUIRED_PHOTOS) return;

    const url = URL.createObjectURL(blob);
    setPhotos(prev => [...prev, { blob, descriptor, url }]);
  }, [photos.length]);

  const handleRetake = (index: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleReset = () => {
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]);
  };

  const handleSave = async () => {
    if (!employee.id || photos.length < REQUIRED_PHOTOS) return;

    setSaving(true);
    try {
      // Upload photos in parallel
      const photoUrls = await Promise.all(
        photos.map((photo, i) =>
          faceRecognitionService.uploadFacePhoto(photo.blob, tenantId, employee.id!, i)
        )
      );

      // Save embeddings
      await registerFace.mutateAsync({
        employeeId: employee.id!,
        employeeName,
        embeddings: photos.map(p => Array.from(p.descriptor)),
        photoUrls,
        registeredBy: user?.email || 'admin',
      });

      // Update employee photoUrl with first photo
      await employeeService.updateEmployee(tenantId, employee.id!, {
        photoUrl: photoUrls[0],
      });

      toast({
        title: 'Face Enrolled',
        description: `${employeeName} can now use facial clock-in.`,
      });

      handleReset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Face registration failed:', error);
      toast({
        title: 'Registration Failed',
        description: 'Could not save face data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-cyan-500" />
            Enroll Face — {employeeName}
          </DialogTitle>
          <DialogDescription>
            Capture {REQUIRED_PHOTOS} photos from different angles for accurate recognition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera or completion */}
          {!allCaptured ? (
            <>
              <FaceCamera
                onFaceDetected={() => setFaceDetected(true)}
                onCapture={handleCapture}
                active={open && !allCaptured}
                showBoundingBox
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Step {currentStep + 1}/{REQUIRED_PHOTOS}: {PROMPTS[currentStep]}
                </p>
                <Button
                  size="sm"
                  disabled={!faceDetected}
                  onClick={() => {
                    // Trigger capture via detection callback
                    // The next onCapture call from FaceCamera will add the photo
                    setFaceDetected(false);
                  }}
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
                >
                  <Camera className="h-4 w-4 mr-1" />
                  Capture
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-20 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <Check className="h-6 w-6 text-green-600 mr-2" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                All {REQUIRED_PHOTOS} photos captured!
              </span>
            </div>
          )}

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  <img src={photo.url} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRetake(i)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {photos.length > 0 && !saving && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!allCaptured || saving}
            className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:from-cyan-600 hover:to-teal-600"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Enrollment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
