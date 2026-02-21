/**
 * Ekipa — Edit Profile Screen
 * Premium dark theme with green (#22C55E) accent.
 * Edit personal info (phone, address, emergency contact).
 * Bank details create a change request instead of direct update.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Heart,
  Landmark,
  Save,
  Info,
} from 'lucide-react-native';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useTenantStore } from '../../stores/tenantStore';
import { useEmployeeStore } from '../../stores/employeeStore';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../lib/i18n';
import { colors } from '../../lib/colors';

const GREEN = '#22C55E';

export default function EditProfile() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const tenantId = useTenantStore((s) => s.tenantId);
  const employeeId = useTenantStore((s) => s.employeeId);
  const employee = useEmployeeStore((s) => s.employee);
  const fetchEmployee = useEmployeeStore((s) => s.fetchEmployee);
  const user = useAuthStore((s) => s.user);

  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill from employee data
  useEffect(() => {
    if (employee) {
      setPhone(employee.phone || '');
      setAddress(employee.address || '');
      // Emergency & bank fields are read from employee doc if available
      const emp = employee as any;
      setEmergencyName(emp.emergencyContactName || '');
      setEmergencyPhone(emp.emergencyContactPhone || '');
      setBankAccountName(emp.bankAccountName || '');
      setBankAccountNumber(emp.bankAccountNumber || '');
    }
  }, [employee]);

  const handleSave = async () => {
    if (!tenantId || !employeeId) return;

    setSaving(true);
    try {
      // 1. Update non-sensitive fields directly
      const empRef = doc(db, `tenants/${tenantId}/employees/${employeeId}`);
      await updateDoc(empRef, {
        phone: phone.trim(),
        address: address.trim(),
        emergencyContactName: emergencyName.trim(),
        emergencyContactPhone: emergencyPhone.trim(),
        updatedAt: serverTimestamp(),
      });

      // 2. Bank details: create change request instead of direct update
      const hasBankChanges =
        bankAccountName.trim() !== ((employee as any)?.bankAccountName || '') ||
        bankAccountNumber.trim() !== ((employee as any)?.bankAccountNumber || '');

      if (hasBankChanges && (bankAccountName.trim() || bankAccountNumber.trim())) {
        await addDoc(
          collection(db, `tenants/${tenantId}/employees/${employeeId}/change_requests`),
          {
            type: 'bank_details',
            status: 'pending',
            requestedBy: user?.uid || '',
            requestedAt: serverTimestamp(),
            changes: {
              bankAccountName: bankAccountName.trim(),
              bankAccountNumber: bankAccountNumber.trim(),
            },
            previousValues: {
              bankAccountName: (employee as any)?.bankAccountName || '',
              bankAccountNumber: (employee as any)?.bankAccountNumber || '',
            },
          }
        );
      }

      // Refresh employee data
      await fetchEmployee(tenantId, employeeId);

      Alert.alert(
        t('common.success'),
        hasBankChanges
          ? t('editProfile.savedWithBankRequest')
          : t('editProfile.saved'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert(t('common.error'), t('editProfile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Green hero header */}
      <View style={styles.heroHeader}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitleWhite}>{t('editProfile.title')}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Phone */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Phone size={16} color={GREEN} strokeWidth={2} />
            <Text style={styles.fieldLabelText}>{t('editProfile.phone')}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('editProfile.phonePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Address */}
        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <MapPin size={16} color={GREEN} strokeWidth={2} />
            <Text style={styles.fieldLabelText}>{t('editProfile.address')}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={address}
            onChangeText={setAddress}
            placeholder={t('editProfile.addressPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

        {/* Emergency contact section */}
        <Text style={styles.sectionTitle}>{t('editProfile.emergencyContact')}</Text>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Heart size={16} color={colors.error} strokeWidth={2} />
            <Text style={styles.fieldLabelText}>{t('editProfile.emergencyName')}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder={t('editProfile.emergencyNamePlaceholder')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Phone size={16} color={colors.error} strokeWidth={2} />
            <Text style={styles.fieldLabelText}>{t('editProfile.emergencyPhone')}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            placeholder={t('editProfile.emergencyPhonePlaceholder')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
        </View>

        {/* Bank details section */}
        <Text style={styles.sectionTitle}>{t('editProfile.bankDetails')}</Text>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Info size={16} color={colors.blue} strokeWidth={2} />
          <Text style={styles.infoBannerText}>
            {t('editProfile.bankInfoNote')}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Landmark size={16} color={colors.blue} strokeWidth={2} />
            <Text style={styles.fieldLabelText}>{t('editProfile.bankName')}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={bankAccountName}
            onChangeText={setBankAccountName}
            placeholder={t('editProfile.bankNamePlaceholder')}
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldLabel}>
            <Landmark size={16} color={colors.blue} strokeWidth={2} />
            <Text style={styles.fieldLabelText}>{t('editProfile.bankNumber')}</Text>
          </View>
          <TextInput
            style={styles.input}
            value={bankAccountNumber}
            onChangeText={setBankAccountNumber}
            placeholder={t('editProfile.bankNumberPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Save size={18} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>{t('editProfile.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // -- Green hero header --
  heroHeader: {
    backgroundColor: GREEN,
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

  // -- Section title --
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 28,
    marginBottom: 4,
  },

  // -- Field groups --
  fieldGroup: {
    marginTop: 16,
    gap: 8,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bgCard,
  },
  textarea: {
    height: 70,
    paddingTop: 13,
  },

  // -- Info banner --
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.blueBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginTop: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.blue,
    lineHeight: 19,
  },

  // -- Save button --
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    borderRadius: 14,
    padding: 16,
    backgroundColor: GREEN,
    ...Platform.select({
      ios: {
        shadowColor: GREEN,
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
  saveBtnText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
});

/*
 * i18n keys to add to lib/i18n.ts:
 *
 * 'editProfile.title':                  { tet: 'Edita Perfil', en: 'Edit Profile' }
 * 'editProfile.phone':                  { tet: 'Telefone', en: 'Phone' }
 * 'editProfile.phonePlaceholder':       { tet: '+670 7xxx xxxx', en: '+670 7xxx xxxx' }
 * 'editProfile.address':                { tet: 'Enderesu', en: 'Address' }
 * 'editProfile.addressPlaceholder':     { tet: 'Hakerek ita-nia enderesu', en: 'Enter your address' }
 * 'editProfile.emergencyContact':       { tet: 'Kontaktu emerjénsia', en: 'Emergency Contact' }
 * 'editProfile.emergencyName':          { tet: 'Naran kontaktu', en: 'Contact name' }
 * 'editProfile.emergencyNamePlaceholder': { tet: 'Naran ema ida', en: 'Name of contact person' }
 * 'editProfile.emergencyPhone':         { tet: 'Telefone emerjénsia', en: 'Emergency phone' }
 * 'editProfile.emergencyPhonePlaceholder': { tet: '+670 7xxx xxxx', en: '+670 7xxx xxxx' }
 * 'editProfile.bankDetails':            { tet: 'Detallu bankáriu', en: 'Bank Details' }
 * 'editProfile.bankInfoNote':           { tet: 'Mudansa bankáriu presiza aprovação RH. Sei kria pedidu mudansa.', en: 'Bank changes require HR approval. A change request will be created.' }
 * 'editProfile.bankName':               { tet: 'Naran konta bankáriu', en: 'Bank account name' }
 * 'editProfile.bankNamePlaceholder':    { tet: 'Naran iha konta banku', en: 'Name on bank account' }
 * 'editProfile.bankNumber':             { tet: 'Numeru konta bankáriu', en: 'Bank account number' }
 * 'editProfile.bankNumberPlaceholder':  { tet: 'Numeru konta', en: 'Account number' }
 * 'editProfile.save':                   { tet: 'Rai', en: 'Save' }
 * 'editProfile.saved':                  { tet: 'Informasaun rai ho susesu', en: 'Information saved successfully' }
 * 'editProfile.savedWithBankRequest':   { tet: 'Informasaun rai ona. Mudansa bankáriu presiza aprovação RH.', en: 'Info saved. Bank detail changes need HR approval.' }
 * 'editProfile.saveError':              { tet: 'La konsege rai. Favór koko fali.', en: 'Could not save. Please try again.' }
 */
