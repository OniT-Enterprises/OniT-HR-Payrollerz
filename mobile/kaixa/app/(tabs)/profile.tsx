/**
 * Kaixa — Profile / Settings Screen (Konta) v2
 * Sharp editorial dark theme. Friendly descriptions.
 *
 * Includes editable business profile section.
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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  LogOut,
  Globe,
  DollarSign,
  Info,
  Building2,
  RefreshCw,
  Save,
  MapPin,
  Phone,
  FileText,
  Edit3,
  X,
  Check,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { useVATStore } from '../../stores/vatStore';
import { colors } from '../../lib/colors';
import { SectionLabel, ChipIcon } from '../../components/ui';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { tenantName, tenantId, role, setTenant, clearTenant } = useTenantStore();
  const {
    profile: bizProfile,
    loading: bizLoading,
    saving: bizSaving,
    load: loadBizProfile,
    save: saveBizProfile,
  } = useBusinessProfileStore();
  const vatActive = useVATStore((s) => s.isVATActive());

  const [editing, setEditing] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizVatReg, setBizVatReg] = useState('');
  const [switcherVisible, setSwitcherVisible] = useState(false);

  useEffect(() => {
    if (tenantId) loadBizProfile(tenantId);
  }, [tenantId, loadBizProfile]);

  useEffect(() => {
    setBizName(bizProfile.businessName);
    setBizAddress(bizProfile.address);
    setBizPhone(bizProfile.phone);
    setBizVatReg(bizProfile.vatRegNumber);
  }, [bizProfile]);

  const startEditing = () => setEditing(true);
  const cancelEditing = () => {
    setBizName(bizProfile.businessName);
    setBizAddress(bizProfile.address);
    setBizPhone(bizProfile.phone);
    setBizVatReg(bizProfile.vatRegNumber);
    setEditing(false);
  };

  const saveProfile = async () => {
    if (!tenantId) return;
    try {
      await saveBizProfile(tenantId, {
        businessName: bizName.trim(),
        address: bizAddress.trim(),
        phone: bizPhone.trim(),
        vatRegNumber: bizVatReg.trim(),
      });
      setEditing(false);
      Alert.alert('Susesu', 'Business profile saved');
    } catch {
      Alert.alert('Error', 'Failed to save profile');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { clearTenant(); signOut(); }},
    ]);
  };

  const switchBusiness = async (
    nextTenantId: string,
    name: string,
    nextRole: string
  ) => {
    await setTenant(nextTenantId, name, nextRole);
    setSwitcherVisible(false);
    router.replace('/(tabs)');
  };

  const tenantEntries = Object.entries(profile?.tenantAccess || {});
  const appVersion = Constants.expoConfig?.version || '0.1.0';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {(profile?.displayName || 'U')[0].toUpperCase()}
          </Text>
        </LinearGradient>
        <Text style={styles.name}>{profile?.displayName || 'User'}</Text>
        <Text style={styles.email}>{profile?.email || ''}</Text>
      </View>

      {/* Business Profile */}
      {tenantId && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionLabel style={styles.sectionLabelInline}>NEGOSIU</SectionLabel>
            <Text style={styles.sectionHint}>Your business details for receipts</Text>
            {!editing ? (
              <TouchableOpacity onPress={startEditing} style={styles.editButton} activeOpacity={0.7}>
                <Edit3 size={12} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={cancelEditing} style={styles.cancelButton} activeOpacity={0.7}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveProfile} style={styles.saveButton} disabled={bizSaving} activeOpacity={0.7}>
                  {bizSaving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Save size={12} color={colors.white} strokeWidth={2} />
                      <Text style={styles.saveText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {bizLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : (
            <>
              <View style={styles.fieldRow}>
                <ChipIcon icon={Building2} tone="neutral" size={30} />
                {editing ? (
                  <TextInput style={styles.fieldInput} value={bizName} onChangeText={setBizName} placeholder="Business name" placeholderTextColor={colors.textTertiary} />
                ) : (
                  <View style={styles.fieldDisplay}>
                    <Text style={styles.fieldLabel}>Naran</Text>
                    <Text style={[styles.fieldValue, !(bizProfile.businessName || tenantName) && styles.fieldValueEmpty]}>{bizProfile.businessName || tenantName || '—'}</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldRow}>
                <ChipIcon icon={MapPin} tone="neutral" size={30} />
                {editing ? (
                  <TextInput style={styles.fieldInput} value={bizAddress} onChangeText={setBizAddress} placeholder="Address" placeholderTextColor={colors.textTertiary} />
                ) : (
                  <View style={styles.fieldDisplay}>
                    <Text style={styles.fieldLabel}>Enderesu</Text>
                    <Text style={[styles.fieldValue, !bizProfile.address && styles.fieldValueEmpty]}>{bizProfile.address || '—'}</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldRow}>
                <ChipIcon icon={Phone} tone="neutral" size={30} />
                {editing ? (
                  <TextInput style={styles.fieldInput} value={bizPhone} onChangeText={setBizPhone} placeholder="Phone number" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" />
                ) : (
                  <View style={styles.fieldDisplay}>
                    <Text style={styles.fieldLabel}>Telefone</Text>
                    <Text style={[styles.fieldValue, !bizProfile.phone && styles.fieldValueEmpty]}>{bizProfile.phone || '—'}</Text>
                  </View>
                )}
              </View>

              {(editing || vatActive || bizProfile.vatRegNumber) && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <ChipIcon icon={FileText} tone="neutral" size={30} />
                  {editing ? (
                    <TextInput style={styles.fieldInput} value={bizVatReg} onChangeText={setBizVatReg} placeholder="VAT registration number" placeholderTextColor={colors.textTertiary} />
                  ) : (
                    <View style={styles.fieldDisplay}>
                      <Text style={styles.fieldLabel}>VAT No.</Text>
                      <Text style={[styles.fieldValue, !bizProfile.vatRegNumber && styles.fieldValueEmpty]}>{bizProfile.vatRegNumber || '—'}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <ChipIcon icon={Info} tone="neutral" size={30} />
                <View style={styles.fieldDisplay}>
                  <Text style={styles.fieldLabel}>Papel</Text>
                  <Text style={styles.fieldValue}>{role}</Text>
                </View>
              </View>

              {profile?.tenantAccess && Object.keys(profile.tenantAccess).length > 1 && (
                <TouchableOpacity
                  style={styles.switchButton}
                  onPress={() => setSwitcherVisible(true)}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={13} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.switchButtonText}>Troka Negosiu</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <SectionLabel style={styles.sectionLabelInline}>DEFINISAUN</SectionLabel>
        </View>

        <View style={styles.menuItem}>
          <View style={styles.menuLeft}>
            <Globe size={16} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Lian · Language</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>Tetun + English</Text>
          </View>
        </View>

        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <View style={styles.menuLeft}>
            <DollarSign size={16} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Moeda · Currency</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>USD ($)</Text>
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Versaun</Text>
          <Text style={styles.menuValue}>{appVersion}</Text>
        </View>
        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.menuText}>Powered by</Text>
          <Text style={[styles.menuValue, { color: colors.primary }]}>Meza</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
        <LogOut size={16} color={colors.moneyOut} strokeWidth={2} />
        <Text style={styles.signOutText}>Sai (Sign Out)</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Kaixa by OniT — Timor-Leste</Text>

      <Modal
        visible={switcherVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSwitcherVisible(false)}
      >
        <View style={styles.switcherContainer}>
          <View style={styles.switcherHeader}>
            <TouchableOpacity
              style={styles.switcherClose}
              onPress={() => setSwitcherVisible(false)}
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.switcherTitle}>Troka Negósiu</Text>
            <View style={styles.switcherClose} />
          </View>
          <Text style={styles.switcherHint}>
            Choose which business you want to manage in Kaixa.
          </Text>
          <View style={styles.switcherList}>
            {tenantEntries.map(([id, info]) => {
              const selected = id === tenantId;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.tenantOption, selected && styles.tenantOptionActive]}
                  onPress={() => switchBusiness(id, info.name, info.role)}
                  disabled={selected}
                  activeOpacity={0.75}
                >
                  <ChipIcon
                    icon={Building2}
                    tone={selected ? 'primary' : 'neutral'}
                    size={38}
                  />
                  <View style={styles.tenantOptionText}>
                    <Text style={styles.tenantOptionName}>{info.name}</Text>
                    <Text style={styles.tenantOptionRole}>{info.role}</Text>
                  </View>
                  {selected && (
                    <Check size={18} color={colors.primary} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 120 },

  profileCard: {
    backgroundColor: colors.bgCard, borderRadius: 16, padding: 28,
    alignItems: 'center', marginBottom: 28, borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: colors.white },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  email: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },

  section: {
    backgroundColor: colors.bgCard, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20,
    marginBottom: 28, borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  sectionLabelInline: { marginBottom: 0 },
  sectionHint: { fontSize: 11, color: colors.textTertiary, flex: 1 },

  editButton: { width: 26, height: 26, borderRadius: 6, backgroundColor: colors.primaryGlow, alignItems: 'center', justifyContent: 'center' },
  editActions: { flexDirection: 'row', gap: 6 },
  cancelButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.bgElevated },
  cancelText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  saveButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveText: { fontSize: 11, color: colors.white, fontWeight: '700' },

  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: 10 },
  fieldDisplay: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 14, color: colors.textSecondary },
  fieldValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  fieldValueEmpty: { color: colors.textTertiary, fontWeight: '500' },
  fieldInput: { flex: 1, fontSize: 14, color: colors.text, backgroundColor: colors.bgElevated, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 0.5, borderColor: colors.borderMedium },

  switchButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: colors.primaryGlow, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  switchButtonText: { fontSize: 13, fontWeight: '600', color: colors.primary },

  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuText: { fontSize: 14, color: colors.text },
  menuValue: { fontSize: 13, color: colors.textTertiary },

  signOutButton: {
    backgroundColor: colors.bgCard, borderRadius: 14, padding: 15,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(251, 113, 133, 0.15)',
    marginTop: 4, flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: colors.moneyOut },

  footer: { textAlign: 'center', color: colors.textTertiary, fontSize: 11, marginTop: 24, letterSpacing: 0.3 },

  switcherContainer: { flex: 1, backgroundColor: colors.bg },
  switcherHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.bgCard, borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  switcherClose: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  switcherTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  switcherHint: {
    fontSize: 13, lineHeight: 19, color: colors.textSecondary,
    paddingHorizontal: 20, paddingTop: 20,
  },
  switcherList: { padding: 20, gap: 8 },
  tenantOption: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, gap: 12,
  },
  tenantOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryGlow },
  tenantOptionText: { flex: 1 },
  tenantOptionName: { fontSize: 15, fontWeight: '700', color: colors.text },
  tenantOptionRole: {
    fontSize: 11, color: colors.textTertiary, marginTop: 2, textTransform: 'capitalize',
  },
});
