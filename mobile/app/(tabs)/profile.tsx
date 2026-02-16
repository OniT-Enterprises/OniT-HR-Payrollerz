/**
 * Kaixa — Profile / Settings Screen (Konta)
 * Dark theme with gradient avatar, warm accents
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LogOut,
  Globe,
  DollarSign,
  Bell,
  Info,
  ChevronRight,
  Building2,
  RefreshCw,
  Save,
  MapPin,
  Phone,
  FileText,
  Edit3,
} from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useTenantStore } from '../../stores/tenantStore';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { useVATStore } from '../../stores/vatStore';
import { colors } from '../../lib/colors';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const { tenantName, tenantId, role, clearTenant } = useTenantStore();
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

  // Load business profile on mount
  useEffect(() => {
    if (tenantId) {
      loadBizProfile(tenantId);
    }
  }, [tenantId, loadBizProfile]);

  // Sync form fields when profile loads
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
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          clearTenant();
          signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
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
            <Building2 size={14} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.sectionTitle}>NEGOSIU</Text>
            {!editing ? (
              <TouchableOpacity
                onPress={startEditing}
                style={styles.editButton}
                activeOpacity={0.7}
              >
                <Edit3 size={13} color={colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={cancelEditing}
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveProfile}
                  style={styles.saveButton}
                  disabled={bizSaving}
                  activeOpacity={0.7}
                >
                  {bizSaving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Save size={13} color={colors.white} strokeWidth={2} />
                      <Text style={styles.saveText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {bizLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ paddingVertical: 20 }}
            />
          ) : (
            <>
              {/* Business Name */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Building2
                    size={16}
                    color={colors.textTertiary}
                    strokeWidth={1.8}
                  />
                </View>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={bizName}
                    onChangeText={setBizName}
                    placeholder="Business name"
                    placeholderTextColor={colors.textTertiary}
                  />
                ) : (
                  <View style={styles.fieldDisplay}>
                    <Text style={styles.fieldLabel}>Naran</Text>
                    <Text style={styles.fieldValue}>
                      {bizProfile.businessName || tenantName || '—'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Address */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <MapPin
                    size={16}
                    color={colors.textTertiary}
                    strokeWidth={1.8}
                  />
                </View>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={bizAddress}
                    onChangeText={setBizAddress}
                    placeholder="Address"
                    placeholderTextColor={colors.textTertiary}
                  />
                ) : (
                  <View style={styles.fieldDisplay}>
                    <Text style={styles.fieldLabel}>Enderesu</Text>
                    <Text style={styles.fieldValue}>
                      {bizProfile.address || '—'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Phone */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Phone
                    size={16}
                    color={colors.textTertiary}
                    strokeWidth={1.8}
                  />
                </View>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={bizPhone}
                    onChangeText={setBizPhone}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <View style={styles.fieldDisplay}>
                    <Text style={styles.fieldLabel}>Telefone</Text>
                    <Text style={styles.fieldValue}>
                      {bizProfile.phone || '—'}
                    </Text>
                  </View>
                )}
              </View>

              {/* VAT Registration — only show when VAT is active */}
              {(vatActive || bizProfile.vatRegNumber) && (
                <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.fieldIcon}>
                    <FileText
                      size={16}
                      color={colors.textTertiary}
                      strokeWidth={1.8}
                    />
                  </View>
                  {editing ? (
                    <TextInput
                      style={styles.fieldInput}
                      value={bizVatReg}
                      onChangeText={setBizVatReg}
                      placeholder="VAT registration number"
                      placeholderTextColor={colors.textTertiary}
                    />
                  ) : (
                    <View style={styles.fieldDisplay}>
                      <Text style={styles.fieldLabel}>VAT No.</Text>
                      <Text style={styles.fieldValue}>
                        {bizProfile.vatRegNumber || '—'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Role */}
              <View style={[styles.fieldRow, { borderBottomWidth: 0 }]}>
                <View style={styles.fieldIcon}>
                  <Info
                    size={16}
                    color={colors.textTertiary}
                    strokeWidth={1.8}
                  />
                </View>
                <View style={styles.fieldDisplay}>
                  <Text style={styles.fieldLabel}>Papel</Text>
                  <Text style={styles.fieldValue}>{role}</Text>
                </View>
              </View>

              {/* Switch business */}
              {profile?.tenantAccess &&
                Object.keys(profile.tenantAccess).length > 1 && (
                  <TouchableOpacity
                    style={styles.switchButton}
                    activeOpacity={0.7}
                  >
                    <RefreshCw
                      size={14}
                      color={colors.primary}
                      strokeWidth={2}
                    />
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
          <Info size={14} color={colors.textTertiary} strokeWidth={2} />
          <Text style={styles.sectionTitle}>DEFINISAUN</Text>
        </View>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
          <View style={styles.menuLeft}>
            <Globe size={18} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Lian (Language)</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>Tetun</Text>
            <ChevronRight
              size={16}
              color={colors.textTertiary}
              strokeWidth={2}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
          <View style={styles.menuLeft}>
            <DollarSign
              size={18}
              color={colors.textSecondary}
              strokeWidth={1.8}
            />
            <Text style={styles.menuText}>Moeda (Currency)</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>USD ($)</Text>
            <ChevronRight
              size={16}
              color={colors.textTertiary}
              strokeWidth={2}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} activeOpacity={0.6}>
          <View style={styles.menuLeft}>
            <Bell size={18} color={colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.menuText}>Notifikasaun</Text>
          </View>
          <View style={styles.menuRight}>
            <Text style={styles.menuValue}>On</Text>
            <ChevronRight
              size={16}
              color={colors.textTertiary}
              strokeWidth={2}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <View style={styles.menuItem}>
          <Text style={styles.menuText}>Versaun</Text>
          <Text style={styles.menuValue}>0.1.0</Text>
        </View>
        <View style={[styles.menuItem, { borderBottomWidth: 0 }]}>
          <Text style={styles.menuText}>Powered by</Text>
          <Text style={[styles.menuValue, { color: colors.primary }]}>
            Meza
          </Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <LogOut size={18} color={colors.error} strokeWidth={2} />
        <Text style={styles.signOutText}>Sai (Sign Out)</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Kaixa by OniT - Timor-Leste</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Sections
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    flex: 1,
  },

  // Edit / Save buttons in header
  editButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(224, 141, 107, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
  },
  cancelText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: '700',
  },

  // Field rows
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: 10,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldDisplay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  switchButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(224, 141, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(224, 141, 107, 0.2)',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  switchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuText: {
    fontSize: 15,
    color: colors.text,
  },
  menuValue: {
    fontSize: 14,
    color: colors.textTertiary,
  },

  // Sign Out
  signOutButton: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },

  footer: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 24,
  },
});
