/**
 * CrewClockOut — 3-step wizard for supervisor crew clock-out
 * Step 1: Select workers (from today's clock-ins)
 * Step 2: Optional photo
 * Step 3: Review & submit
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Camera,
  X,
  RotateCcw,
  Clock,
  Users,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useT } from '../../lib/i18n';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { useCrewStore } from '../../stores/crewStore';
import { compressPhoto, savePhotoLocally } from '../../lib/photoUtils';
import { WorkerCheckRow } from '../../components/WorkerCheckRow';
import { Card } from '../../components/Card';
import type { PendingClockIn } from '../../types/crew';

export default function CrewClockOutScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId)!;
  const user = useAuthStore((s) => s.user)!;
  const profile = useAuthStore((s) => s.profile)!;

  const workers = useCrewStore((s) => s.workers);
  const selectedWorkerIds = useCrewStore((s) => s.selectedWorkerIds);
  const currentDate = useCrewStore((s) => s.currentDate);
  const currentPhoto = useCrewStore((s) => s.currentPhoto);
  const submitting = useCrewStore((s) => s.submitting);
  const fetchWorkers = useCrewStore((s) => s.fetchWorkers);
  const toggleWorker = useCrewStore((s) => s.toggleWorker);
  const selectAll = useCrewStore((s) => s.selectAll);
  const deselectAll = useCrewStore((s) => s.deselectAll);
  const setPhoto = useCrewStore((s) => s.setPhoto);
  const submitBatch = useCrewStore((s) => s.submitBatch);
  const getWorkersNeedingClockOut = useCrewStore((s) => s.getWorkersNeedingClockOut);
  const reset = useCrewStore((s) => s.reset);

  const [step, setStep] = useState(1);
  const [clockedInRecords, setClockedInRecords] = useState<PendingClockIn[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    const init = async () => {
      await fetchWorkers(tenantId);
      reset();
      const records = getWorkersNeedingClockOut(tenantId);
      setClockedInRecords(records);
    };
    init();
  }, [tenantId, fetchWorkers, reset, getWorkersNeedingClockOut]);

  // Filter workers to only those who clocked in today
  const clockedInIds = new Set(clockedInRecords.map((r) => r.employeeId));
  const availableWorkers = workers.filter((w) => clockedInIds.has(w.employeeId));

  const selectedAvailableCount = availableWorkers.filter((w) => selectedWorkerIds.has(w.employeeId)).length;
  const canProceedStep1 = selectedAvailableCount > 0;
  const selectedWorkers = availableWorkers.filter((w) => selectedWorkerIds.has(w.employeeId));
  const getSubmissionErrorMessage = useCallback((error: 'no_workers_selected' | 'submission_failed') =>
    error === 'no_workers_selected' ? t('crew.selectAtLeastOne') : t('crew.submitError'), [t]);

  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        const compressed = await compressPhoto(photo.uri);
        setPhotoPreview(compressed);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Photo is optional for clock-out
    }
  }, []);

  const handleUsePhoto = useCallback(async () => {
    if (!photoPreview) return;
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localPath = await savePhotoLocally(photoPreview, batchId);
    setPhoto(localPath);
    setStep(3);
  }, [photoPreview, setPhoto]);

  const handleSkipPhoto = useCallback(() => {
    setStep(3);
  }, []);

  const handleSubmit = useCallback(async () => {
    const result = await submitBatch({
      tenantId,
      supervisorId: user.uid,
      supervisorName: profile.displayName || user.email || '',
    });

    if (!result.ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('common.error'), getSubmissionErrorMessage(result.error));
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }, [tenantId, user, profile, submitBatch, router, t, getSubmissionErrorMessage]);

  // Calculate estimated hours for each worker
  const getClockInTime = (employeeId: string): string => {
    const record = clockedInRecords.find((r) => r.employeeId === employeeId);
    return record?.clockIn || '--:--';
  };

  const renderStep1 = () => (
    <View style={styles.stepContentFlex}>
      <Text style={styles.stepTitle}>{t('crew.selectWorkersClockOut')}</Text>
      <Text style={styles.stepSub}>{t('crew.selectWorkersClockOutSub')}</Text>
      {availableWorkers.length === 0 ? (
        <View style={styles.emptyState}>
          <Users size={32} color={colors.textTertiary} strokeWidth={1.5} />
          <Text style={styles.emptyText}>{t('crew.noWorkersToClockOut')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.selectActions}>
            <TouchableOpacity onPress={() => selectAll(availableWorkers.map((w) => w.employeeId))}>
              <Text style={styles.selectActionText}>{t('crew.selectAllAction')}</Text>
            </TouchableOpacity>
            <Text style={styles.selectCount}>
              {selectedAvailableCount}/{availableWorkers.length}
            </Text>
            <TouchableOpacity onPress={deselectAll}>
              <Text style={styles.selectActionText}>{t('crew.deselectAll')}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={availableWorkers}
            keyExtractor={(item) => item.employeeId}
            contentContainerStyle={styles.workerList}
            renderItem={({ item }) => (
              <View style={styles.workerRow}>
                <WorkerCheckRow
                  name={`${item.firstName} ${item.lastName}`}
                  department={item.department}
                  selected={selectedWorkerIds.has(item.employeeId)}
                  onToggle={() => toggleWorker(item.employeeId)}
                />
                <View style={styles.clockInTime}>
                  <Clock size={12} color={colors.textTertiary} strokeWidth={2} />
                  <Text style={styles.clockInTimeText}>
                    {getClockInTime(item.employeeId)}
                  </Text>
                </View>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        </>
      )}
    </View>
  );

  const renderStep2 = () => {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>{t('crew.optionalPhoto')}</Text>
          <Text style={styles.stepSub}>{t('crew.optionalPhotoSub')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestCameraPermission}>
            <Camera size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.primaryBtnText}>{t('crew.enableCamera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkipPhoto}>
            <Text style={styles.skipBtnText}>{t('crew.skip')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (photoPreview) {
      return (
        <View style={styles.cameraContainer}>
          <Image source={{ uri: photoPreview }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={() => setPhotoPreview(null)}>
              <RotateCcw size={20} color={colors.text} strokeWidth={2} />
              <Text style={styles.retakeBtnText}>{t('crew.retake')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleUsePhoto}>
              <Check size={20} color="#fff" strokeWidth={2} />
              <Text style={styles.primaryBtnText}>{t('crew.usePhoto')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkipPhoto}>
            <Text style={styles.skipBtnText}>{t('crew.skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          <View style={{ width: 60 }} />
        </View>
      </View>
    );
  };

  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} contentContainerStyle={{ gap: 16 }}>
      <Text style={styles.stepTitle}>{t('crew.reviewSubmit')}</Text>

      <Card style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('crew.date')}</Text>
          <Text style={styles.reviewValue}>{currentDate}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('crew.clockOutTime')}</Text>
          <Text style={styles.reviewValue}>{nowHHMM()}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('crew.workers')}</Text>
          <Text style={styles.reviewValue}>{selectedAvailableCount}</Text>
        </View>
      </Card>

      {currentPhoto ? (
        <Image source={{ uri: currentPhoto }} style={styles.reviewPhoto} resizeMode="cover" />
      ) : null}

      <View style={styles.reviewWorkerList}>
        <Text style={styles.reviewWorkerHeader}>{t('crew.selectedWorkers')}</Text>
        {selectedWorkers.map((w) => (
          <View key={w.employeeId} style={styles.reviewWorkerRow}>
            <Check size={14} color={colors.success} strokeWidth={2} />
            <Text style={styles.reviewWorkerName}>
              {w.firstName} {w.lastName}
            </Text>
            <Text style={styles.reviewWorkerDept}>
              {getClockInTime(w.employeeId)} → {nowHHMM()}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Check size={20} color="#fff" strokeWidth={2.5} />
            <Text style={styles.submitBtnText}>{t('crew.submitClockOut')}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
          style={styles.backBtn}
        >
          {step > 1 ? (
            <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
          ) : (
            <X size={22} color={colors.text} strokeWidth={2} />
          )}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('crew.clockOut')} — {t('crew.step')} {step}/3
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
      </View>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      {step === 1 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceedStep1 && styles.nextBtnDisabled]}
            onPress={() => setStep(2)}
            disabled={!canProceedStep1}
          >
            <Text style={styles.nextBtnText}>{t('crew.next')}</Text>
            <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  progressBar: { height: 3, backgroundColor: colors.bgSubtle },
  progressFill: { height: 3, backgroundColor: colors.primary },
  stepContent: { flex: 1, padding: 20, gap: 16 },
  stepContentFlex: { flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  stepSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: colors.textTertiary, fontWeight: '500' },
  selectActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectActionText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  selectCount: { fontSize: 13, fontWeight: '700', color: colors.text },
  workerList: { paddingBottom: 20 },
  workerRow: { gap: 4 },
  clockInTime: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 40 },
  clockInTimeText: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  photoPreview: { flex: 1 },
  photoActions: {
    flexDirection: 'row', gap: 12, padding: 20, backgroundColor: colors.bgCard,
  },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.bgSubtle, borderRadius: 10, paddingVertical: 14,
  },
  retakeBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20,
  },
  skipBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  reviewCard: { gap: 10 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  reviewValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  reviewPhoto: { width: '100%', height: 160, borderRadius: 12 },
  reviewWorkerList: { gap: 8 },
  reviewWorkerHeader: { fontSize: 14, fontWeight: '700', color: colors.text },
  reviewWorkerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewWorkerName: { fontSize: 14, color: colors.text, fontWeight: '500' },
  reviewWorkerDept: { fontSize: 12, color: colors.textTertiary },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 16, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  footer: {
    padding: 16, backgroundColor: colors.bgCard,
    borderTopWidth: 0.5, borderTopColor: colors.border,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
