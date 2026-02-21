/**
 * CrewClockIn — 4-step wizard for supervisor crew clock-in
 * Step 1: Site & Date
 * Step 2: Select Workers
 * Step 3: Capture Photo (mandatory)
 * Step 4: Review & Submit
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  MapPin,
  Calendar,
  Search,
  Camera,
  ChevronLeft,
  ChevronRight,
  Check,
  QrCode,
  X,
  RotateCcw,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useT } from '../../lib/i18n';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { useCrewStore } from '../../stores/crewStore';
import { getCurrentLocation } from '../../lib/locationUtils';
import { compressPhoto, savePhotoLocally } from '../../lib/photoUtils';
import { WorkerCheckRow } from '../../components/WorkerCheckRow';
import { Card } from '../../components/Card';
import { addDays, isValidISODate, toISODateLocal } from '../../lib/dateInput';
import { DatePickerModal } from '../../components/DatePickerModal';


export default function CrewClockInScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId)!;
  const user = useAuthStore((s) => s.user)!;
  const profile = useAuthStore((s) => s.profile)!;

  const workers = useCrewStore((s) => s.workers);
  const workersLoading = useCrewStore((s) => s.workersLoading);
  const selectedWorkerIds = useCrewStore((s) => s.selectedWorkerIds);
  const currentDate = useCrewStore((s) => s.currentDate);
  const currentSiteName = useCrewStore((s) => s.currentSiteName);
  const currentPhoto = useCrewStore((s) => s.currentPhoto);
  const currentLocation = useCrewStore((s) => s.currentLocation);
  const submitting = useCrewStore((s) => s.submitting);
  const fetchWorkers = useCrewStore((s) => s.fetchWorkers);
  const toggleWorker = useCrewStore((s) => s.toggleWorker);
  const selectAll = useCrewStore((s) => s.selectAll);
  const deselectAll = useCrewStore((s) => s.deselectAll);
  const setSite = useCrewStore((s) => s.setSite);
  const setDate = useCrewStore((s) => s.setDate);
  const setPhoto = useCrewStore((s) => s.setPhoto);
  const setLocation = useCrewStore((s) => s.setLocation);
  const submitBatch = useCrewStore((s) => s.submitBatch);
  const reset = useCrewStore((s) => s.reset);

  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [siteInput, setSiteInput] = useState(currentSiteName || '');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    fetchWorkers(tenantId);
    reset();
    // Get GPS on mount — use callback form to avoid sync setState warning
    const getLocation = async () => {
      setGettingLocation(true);
      const loc = await getCurrentLocation();
      if (loc) setLocation(loc);
      setGettingLocation(false);
    };
    getLocation();
  }, [tenantId, fetchWorkers, reset, setLocation]);

  const filteredWorkers = workers.filter((w) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${w.firstName} ${w.lastName}`.toLowerCase();
    return name.includes(q) || (w.department || '').toLowerCase().includes(q);
  });

  const canProceedStep1 = isValidISODate(currentDate);
  const canProceedStep2 = selectedWorkerIds.size > 0;
  const getSubmissionErrorMessage = useCallback((error: 'no_workers_selected' | 'submission_failed') =>
    error === 'no_workers_selected' ? t('crew.selectAtLeastOne') : t('crew.submitError'), [t]);
  const applyQuickDate = (days: number) => {
    setDate(toISODateLocal(addDays(new Date(), days)));
  };

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
      Alert.alert(t('common.error'), t('crew.photoCaptureError'));
    }
  }, [t]);

  const handleUsePhoto = useCallback(async () => {
    if (!photoPreview) return;
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localPath = await savePhotoLocally(photoPreview, batchId);
    setPhoto(localPath);
    setStep(4);
  }, [photoPreview, setPhoto]);

  const handleRetakePhoto = useCallback(() => {
    setPhotoPreview(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSite(null, siteInput.trim() || null);
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
  }, [tenantId, user, profile, siteInput, submitBatch, setSite, router, t, getSubmissionErrorMessage]);

  const selectedWorkers = workers.filter((w) => selectedWorkerIds.has(w.employeeId));

  // ── Render steps ──

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('crew.siteAndDate')}</Text>
      <Text style={styles.stepSub}>{t('crew.siteAndDateSub')}</Text>
      <View style={styles.field}>
        <View style={styles.fieldLabel}>
          <MapPin size={16} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.fieldLabelText}>{t('crew.siteName')}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={siteInput}
          onChangeText={setSiteInput}
          placeholder={t('crew.siteNamePlaceholder')}
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.fieldLabel}>
          <Calendar size={16} color={colors.textSecondary} strokeWidth={2} />
          <Text style={styles.fieldLabelText}>{t('crew.date')}</Text>
        </View>
        <View style={styles.dateDisplay}>
          <Text style={styles.dateDisplayText}>{currentDate || t('common.selectDate')}</Text>
        </View>
        <TouchableOpacity
          style={styles.datePickerBtn}
          onPress={() => setDatePickerVisible(true)}
          activeOpacity={0.8}
        >
          <Calendar size={16} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.datePickerBtnText}>{t('common.selectDate')}</Text>
        </TouchableOpacity>
        <Text style={styles.quickDateLabel}>{t('crew.quickDate')}</Text>
        <View style={styles.quickDateRow}>
          <TouchableOpacity
            style={styles.quickDateChip}
            onPress={() => applyQuickDate(-1)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickDateChipText}>{t('common.yesterday')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickDateChip}
            onPress={() => applyQuickDate(0)}
            activeOpacity={0.8}
          >
            <Text style={styles.quickDateChipText}>{t('common.today')}</Text>
          </TouchableOpacity>
        </View>
        {!isValidISODate(currentDate) && (
          <Text style={styles.inputError}>{t('crew.invalidDateFormat')}</Text>
        )}
      </View>

      {gettingLocation ? (
        <View style={styles.gpsRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.gpsText}>{t('crew.gettingLocation')}</Text>
        </View>
      ) : currentLocation ? (
        <View style={styles.gpsRow}>
          <MapPin size={14} color={colors.success} strokeWidth={2} />
          <Text style={styles.gpsText}>
            GPS: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            {' '}(±{Math.round(currentLocation.accuracy)}m)
          </Text>
        </View>
      ) : (
        <View style={styles.gpsRow}>
          <MapPin size={14} color={colors.warning} strokeWidth={2} />
          <Text style={styles.gpsText}>{t('crew.noGps')}</Text>
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContentFlex}>
      <Text style={styles.stepTitle}>{t('crew.selectWorkers')}</Text>
      <Text style={styles.stepSub}>{t('crew.selectWorkersSub')}</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Search size={16} color={colors.textTertiary} strokeWidth={2} />
          <TextInput
            style={styles.searchField}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('crew.searchWorkers')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <TouchableOpacity
          style={styles.qrButton}
          onPress={() => router.push('/screens/QRScanner')}
        >
          <QrCode size={20} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.selectActions}>
        <TouchableOpacity onPress={() => selectAll()}>
          <Text style={styles.selectActionText}>{t('crew.selectAllAction')}</Text>
        </TouchableOpacity>
        <Text style={styles.selectCount}>
          {selectedWorkerIds.size}/{workers.length}
        </Text>
        <TouchableOpacity onPress={deselectAll}>
          <Text style={styles.selectActionText}>{t('crew.deselectAll')}</Text>
        </TouchableOpacity>
      </View>

      {workersLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredWorkers}
          keyExtractor={(item) => item.employeeId}
          contentContainerStyle={styles.workerList}
          renderItem={({ item }) => (
            <WorkerCheckRow
              name={`${item.firstName} ${item.lastName}`}
              department={item.department}
              selected={selectedWorkerIds.has(item.employeeId)}
              onToggle={() => toggleWorker(item.employeeId)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );

  const renderStep3 = () => {
    if (!cameraPermission?.granted) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>{t('crew.takePhoto')}</Text>
          <Text style={styles.stepSub}>{t('crew.photoRequired')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestCameraPermission}>
            <Camera size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.primaryBtnText}>{t('crew.enableCamera')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (photoPreview) {
      return (
        <View style={styles.cameraContainer}>
          <Image source={{ uri: photoPreview }} style={styles.photoPreview} />
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetakePhoto}>
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
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraHint}>{t('crew.photoHint')}</Text>
          </View>
        </CameraView>
        <TouchableOpacity style={styles.captureBtn} onPress={handleTakePhoto}>
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{t('crew.reviewSubmit')}</Text>

      <Card style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('crew.date')}</Text>
          <Text style={styles.reviewValue}>{currentDate}</Text>
        </View>
        {siteInput.trim() ? (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>{t('crew.siteName')}</Text>
            <Text style={styles.reviewValue}>{siteInput.trim()}</Text>
          </View>
        ) : null}
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{t('crew.workers')}</Text>
          <Text style={styles.reviewValue}>{selectedWorkerIds.size}</Text>
        </View>
        {currentLocation ? (
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>GPS</Text>
            <Text style={styles.reviewValue}>
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
          </View>
        ) : null}
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
            {w.department ? (
              <Text style={styles.reviewWorkerDept}>{w.department}</Text>
            ) : null}
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
            <Text style={styles.submitBtnText}>{t('crew.submitClockIn')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          {t('crew.clockIn')} — {t('crew.step')} {step}/4
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(step / 4) * 100}%` }]} />
      </View>

      {/* Step content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}

      {/* Next button (steps 1-2 only, step 3 auto-advances) */}
      {step <= 2 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.nextBtn,
              !(step === 1 ? canProceedStep1 : canProceedStep2) && styles.nextBtnDisabled,
            ]}
            onPress={() => setStep(step + 1)}
            disabled={!(step === 1 ? canProceedStep1 : canProceedStep2)}
          >
            <Text style={styles.nextBtnText}>{t('crew.next')}</Text>
            <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}

      <DatePickerModal
        visible={datePickerVisible}
        value={currentDate}
        accentColor={colors.primary}
        title={t('common.selectDate')}
        onClose={() => setDatePickerVisible(false)}
        onSelect={(isoDate) => {
          setDate(isoDate);
          setDatePickerVisible(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
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
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.bgSubtle,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primary,
  },
  stepContent: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  stepContentFlex: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  stepSub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  dateDisplay: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateDisplayText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  datePickerBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  datePickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  quickDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  quickDateChip: {
    backgroundColor: colors.primaryBg,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickDateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  inputError: {
    fontSize: 12,
    color: colors.error,
    fontWeight: '500',
    marginTop: 6,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  gpsText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchField: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  qrButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.primaryBg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selectActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  selectCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  workerList: {
    paddingBottom: 20,
  },
  // Camera step
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
  },
  cameraHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  captureBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  photoPreview: {
    flex: 1,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    backgroundColor: colors.bgCard,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.bgSubtle,
    borderRadius: 10,
    paddingVertical: 14,
  },
  retakeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Review step
  reviewCard: {
    gap: 10,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  reviewValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  reviewPhoto: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  reviewWorkerList: {
    gap: 8,
  },
  reviewWorkerHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  reviewWorkerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewWorkerName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  reviewWorkerDept: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  // Footer
  footer: {
    padding: 16,
    backgroundColor: colors.bgCard,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
