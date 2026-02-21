/**
 * Ekipa — Expense Submission Form
 * Premium dark theme with emerald (#10B981) module accent.
 * Amount, date, category, description, receipt photo upload.
 */
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  X,
  Send,
  Plane,
  ShoppingBag,
  Utensils,
  Car,
  Wrench,
  MoreHorizontal,
  Calendar,
} from 'lucide-react-native';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';
import { toISODateLocal } from '../../lib/dateInput';
import { DatePickerModal } from '../../components/DatePickerModal';
import type { ExpenseCategory } from '../../types/expense';

const ACCENT = colors.emerald;
const ACCENT_BG = colors.emeraldBg;

interface CategoryOption {
  id: ExpenseCategory;
  labelKey: string;
  icon: typeof Plane;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'travel', labelKey: 'expense.travel', icon: Plane },
  { id: 'supplies', labelKey: 'expense.supplies', icon: ShoppingBag },
  { id: 'meals', labelKey: 'expense.meals', icon: Utensils },
  { id: 'transport', labelKey: 'expense.transport', icon: Car },
  { id: 'equipment', labelKey: 'expense.equipment', icon: Wrench },
  { id: 'other', labelKey: 'expense.other', icon: MoreHorizontal },
];

export default function ExpenseForm() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);
  const user = useAuthStore((s) => s.user);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toISODateLocal(new Date()));
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [description, setDescription] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const canSubmit =
    !!tenantId &&
    !!employeeId &&
    parsedAmount > 0 &&
    !!description.trim() &&
    !submitting;

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(t('common.error'), t('expense.photoError'));
    }
  };

  const handleSubmit = async () => {
    if (!tenantId || !employeeId || !employee) return;
    if (parsedAmount <= 0) {
      Alert.alert(t('common.error'), t('expense.invalidAmount'));
      return;
    }

    setSubmitting(true);
    try {
      let receiptUrl: string | undefined;

      // Upload receipt photo if present
      if (receiptUri) {
        const filename = `receipts/${tenantId}/${employeeId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        const response = await fetch(receiptUri);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
        receiptUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, `tenants/${tenantId}/expenses`), {
        tenantId,
        employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        amount: parsedAmount,
        currency: employee.currency || 'USD',
        category,
        date,
        description: description.trim(),
        receiptUrl: receiptUrl || null,
        status: 'submitted',
        submittedBy: user?.uid || '',
        createdAt: serverTimestamp(),
      });

      Alert.alert(t('common.success'), t('expense.submitted'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('expense.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Emerald hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('expense.newTitle')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Amount input */}
        <View style={styles.amountContainer}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            textAlign="center"
          />
        </View>

        {/* Date */}
        <Text style={styles.label}>{t('expense.date')}</Text>
        <TouchableOpacity
          style={styles.dateField}
          onPress={() => setDatePickerVisible(true)}
          activeOpacity={0.8}
        >
          <Calendar size={16} color={ACCENT} strokeWidth={2.2} />
          <Text style={styles.dateFieldText}>{date}</Text>
        </TouchableOpacity>

        {/* Category grid */}
        <Text style={styles.label}>{t('expense.category')}</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryItem, isActive && styles.categoryItemActive]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryIcon, isActive && styles.categoryIconActive]}>
                  <Icon size={22} color={isActive ? colors.white : ACCENT} strokeWidth={1.8} />
                </View>
                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                  {t(cat.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description */}
        <Text style={styles.label}>{t('expense.description')}</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('expense.descriptionPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Receipt photo */}
        <Text style={styles.label}>{t('expense.receipt')}</Text>
        {receiptUri ? (
          <View style={styles.receiptPreview}>
            <Image source={{ uri: receiptUri }} style={styles.receiptImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.removeReceiptBtn}
              onPress={() => setReceiptUri(null)}
              activeOpacity={0.7}
            >
              <X size={16} color={colors.white} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={handlePickImage}
            activeOpacity={0.7}
          >
            <Camera size={22} color={ACCENT} strokeWidth={2} />
            <Text style={styles.cameraBtnText}>{t('expense.captureReceipt')}</Text>
          </TouchableOpacity>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Send size={18} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.submitBtnText}>{t('expense.submit')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <DatePickerModal
        visible={datePickerVisible}
        value={date}
        accentColor={ACCENT}
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // -- Emerald hero header --
  heroHeader: {
    backgroundColor: ACCENT,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroDecor2: {
    position: 'absolute',
    bottom: -24,
    left: 16,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroDecor3: {
    position: 'absolute',
    top: 30,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleWhite: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.3,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // -- Amount input --
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 20,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text,
    minWidth: 120,
    letterSpacing: -1,
  },

  // -- Labels --
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // -- Date --
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.bgCard,
  },
  dateFieldText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  // -- Category grid --
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  categoryItemActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_BG,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconActive: {
    backgroundColor: ACCENT,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  categoryLabelActive: {
    color: ACCENT,
  },

  // -- Input --
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bgCard,
  },
  textarea: {
    height: 80,
    paddingTop: 14,
  },

  // -- Camera / receipt --
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 20,
    backgroundColor: ACCENT_BG,
  },
  cameraBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
  },
  receiptPreview: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  removeReceiptBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // -- Submit --
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    borderRadius: 14,
    padding: 16,
    backgroundColor: ACCENT,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  btnDisabled: {
    opacity: 0.5,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'expense.newTitle':              { tet: 'Despeza Foun', en: 'New Expense' }
 * 'expense.date':                  { tet: 'Data', en: 'Date' }
 * 'expense.category':              { tet: 'Kategoria', en: 'Category' }
 * 'expense.travel':                { tet: 'Viajen', en: 'Travel' }
 * 'expense.supplies':              { tet: 'Material', en: 'Supplies' }
 * 'expense.meals':                 { tet: 'Hahan', en: 'Meals' }
 * 'expense.transport':             { tet: 'Transporte', en: 'Transport' }
 * 'expense.equipment':             { tet: 'Ekipamentu', en: 'Equipment' }
 * 'expense.other':                 { tet: 'Seluk', en: 'Other' }
 * 'expense.description':           { tet: 'Deskrisaun', en: 'Description' }
 * 'expense.descriptionPlaceholder':{ tet: 'Deskrisaun badak kona-ba despeza', en: 'Brief description of the expense' }
 * 'expense.receipt':               { tet: 'Resibo', en: 'Receipt' }
 * 'expense.captureReceipt':        { tet: 'Foti foto resibo', en: 'Capture receipt photo' }
 * 'expense.photoError':            { tet: 'La konsege foti foto', en: 'Could not capture photo' }
 * 'expense.invalidAmount':         { tet: 'Montante tenke liu husi $0', en: 'Amount must be greater than $0' }
 * 'expense.submit':                { tet: 'Submete Despeza', en: 'Submit Expense' }
 * 'expense.submitted':             { tet: 'Despeza submete ho susesu', en: 'Expense submitted successfully' }
 * 'expense.submitError':           { tet: 'La konsege submete despeza', en: 'Could not submit expense' }
 */
