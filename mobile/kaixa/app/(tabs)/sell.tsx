/**
 * Kaixa — POS / Quick Sell Screen (Faan) v2
 * Sharp editorial dark theme. Premium fintech feel.
 * Friendly helper text throughout.
 *
 * Product grid with big tap-to-add buttons.
 * Cart at bottom, checkout creates a Money In transaction.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  Check,
  Trash2,
  Package,
} from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useTenantStore } from '../../stores/tenantStore';
import { useAuthStore } from '../../stores/authStore';
import { useProductStore, type Product } from '../../stores/productStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useVATStore } from '../../stores/vatStore';
import { useBusinessProfileStore } from '../../stores/businessProfileStore';
import { createTransaction } from '../../types/transaction';
import { inferVATCategory } from '@onit/shared';
import { generateTextReceipt } from '../../lib/receipt';
import { getNextReceiptNumber } from '../../lib/receiptCounter';

interface CartItem {
  product: Product;
  qty: number;
}

export default function SellScreen() {
  const { tenantId } = useTenantStore();
  const { user } = useAuthStore();
  const { loading, loadProducts, activeProducts, decrementStock } =
    useProductStore();
  const { addTransaction } = useTransactionStore();
  const { isVATActive, effectiveRate, config } = useVATStore();
  const bizProfile = useBusinessProfileStore((s) => s.profile);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [addProductModal, setAddProductModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const vatActive = isVATActive();
  const vatRate = effectiveRate();

  useEffect(() => {
    if (tenantId) {
      loadProducts(tenantId);
    }
  }, [tenantId, loadProducts]);

  const active = activeProducts();

  const addToCart = useCallback(
    (product: Product) => {
      if (product.stock !== null && product.stock <= 0) {
        Alert.alert('Stoke esgota', `${product.name} has no stock left`);
        return;
      }

      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          if (
            product.stock !== null &&
            existing.qty >= product.stock
          ) {
            Alert.alert(
              'Stoke limitadu',
              `Only ${product.stock} ${product.name} available`
            );
            return prev;
          }
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, qty: item.qty + 1 }
              : item
          );
        }
        return [...prev, { product, qty: 1 }];
      });
    },
    []
  );

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, qty: item.qty + delta }
            : item
        )
        .filter((item) => item.qty > 0);
      return updated;
    });
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );

  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const checkout = async () => {
    if (cart.length === 0 || !tenantId) return;

    setCheckingOut(true);
    try {
      const vatCategory = vatActive
        ? inferVATCategory('sales', config)
        : ('none' as const);

      const itemNames = cart
        .map((item) =>
          item.qty > 1
            ? `${item.product.name} x${item.qty}`
            : item.product.name
        )
        .join(', ');

      const txData = createTransaction({
        type: 'in',
        amount: Math.round(cartTotal * 100) / 100,
        category: 'sales',
        note: itemNames,
        tenantId,
        createdBy: user?.uid || 'anonymous',
        vatRate: vatActive ? vatRate : 0,
        vatCategory,
      });

      const txId = await addTransaction(txData, tenantId);

      for (const item of cart) {
        if (item.product.stock !== null) {
          await decrementStock(tenantId, item.product.id, item.qty);
        }
      }

      let receiptNumber: string | undefined;
      try {
        receiptNumber = await getNextReceiptNumber(tenantId);
      } catch {
        // Continue without receipt number
      }

      const receipt = generateTextReceipt({
        transaction: { ...txData, id: txId },
        businessName: bizProfile.businessName,
        businessPhone: bizProfile.phone,
        businessAddress: bizProfile.address,
        vatRegNumber: bizProfile.vatRegNumber || undefined,
        receiptNumber,
      });

      clearCart();

      Alert.alert(
        'Susesu!',
        `$${cartTotal.toFixed(2)} — ${itemNames}`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Share Receipt',
            onPress: async () => {
              try {
                await Share.share({ message: receipt });
              } catch {
                // User cancelled
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to complete sale');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAddProduct = async () => {
    const price = parseFloat(newPrice);
    if (!newName.trim()) {
      Alert.alert('Error', 'Enter a product name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Enter a valid price');
      return;
    }
    if (!tenantId) return;

    setSaving(true);
    try {
      await useProductStore.getState().addProduct(tenantId, {
        name: newName.trim(),
        price: Math.round(price * 100) / 100,
        category: newCategory.trim(),
      });
      setAddProductModal(false);
      setNewName('');
      setNewPrice('');
      setNewCategory('');
    } catch {
      Alert.alert('Error', 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.gridContainer}
        contentContainerStyle={styles.gridContent}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : active.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Package
                size={28}
                color={colors.textTertiary}
                strokeWidth={1.5}
              />
            </View>
            <Text style={styles.emptyText}>Seidauk iha produtu</Text>
            <Text style={styles.emptySubtext}>
              Add your products here for quick selling.{'\n'}
              Tap the + button to get started.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.gridHint}>
              Tap a product to add it to your cart
            </Text>
            <View style={styles.productGrid}>
              {active.map((product) => {
                const inCart = cart.find((c) => c.product.id === product.id);
                const outOfStock =
                  product.stock !== null && product.stock <= 0;

                return (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.productCard,
                      inCart && styles.productCardActive,
                      outOfStock && styles.productCardDisabled,
                    ]}
                    onPress={() => !outOfStock && addToCart(product)}
                    activeOpacity={outOfStock ? 1 : 0.7}
                  >
                    <Text
                      style={[
                        styles.productName,
                        outOfStock && styles.productNameDisabled,
                      ]}
                      numberOfLines={2}
                    >
                      {product.name}
                    </Text>
                    <Text
                      style={[
                        styles.productPrice,
                        outOfStock && styles.productPriceDisabled,
                      ]}
                    >
                      ${product.price.toFixed(2)}
                    </Text>
                    {product.stock !== null && (
                      <Text
                        style={[
                          styles.productStock,
                          outOfStock && { color: colors.error },
                        ]}
                      >
                        {outOfStock
                          ? 'Out of stock'
                          : `${product.stock} available`}
                      </Text>
                    )}
                    {inCart && (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{inCart.qty}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {cart.length > 0 && (
        <View style={styles.cartBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cartItems}
            contentContainerStyle={styles.cartItemsContent}
          >
            {cart.map((item) => (
              <View key={item.product.id} style={styles.cartItem}>
                <Text style={styles.cartItemName} numberOfLines={1}>
                  {item.product.name}
                </Text>
                <View style={styles.cartItemQty}>
                  <TouchableOpacity
                    onPress={() => updateQty(item.product.id, -1)}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Minus size={12} color={colors.moneyOut} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity
                    onPress={() => updateQty(item.product.id, 1)}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Plus size={12} color={colors.moneyIn} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cartItemTotal}>
                  ${(item.product.price * item.qty).toFixed(2)}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.cartFooter}>
            <TouchableOpacity
              onPress={clearCart}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={colors.moneyOut} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.cartTotalWrap}>
              <Text style={styles.cartTotalLabel}>
                {cartItemCount} item{cartItemCount !== 1 ? 's' : ''} in cart
              </Text>
              <Text style={styles.cartTotalAmount}>
                ${cartTotal.toFixed(2)}
              </Text>
              {vatActive && cartTotal > 0 && (
                <Text style={styles.cartVatHint}>
                  includes VAT at {vatRate}%
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={checkout}
              disabled={checkingOut}
              activeOpacity={0.85}
            >
              {checkingOut ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <ShoppingBag size={16} color={colors.white} strokeWidth={2} />
                  <Text style={styles.checkoutText}>Selu</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, cart.length > 0 && { bottom: 180 }]}
        onPress={() => {
          setNewName('');
          setNewPrice('');
          setNewCategory('');
          setAddProductModal(true);
        }}
        activeOpacity={0.85}
      >
        <Plus size={26} color={colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      <Modal
        visible={addProductModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddProductModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setAddProductModal(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Produtu Foun</Text>
            <TouchableOpacity
              onPress={handleAddProduct}
              style={[styles.modalHeaderBtn, styles.modalSaveBtn]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Check size={18} color={colors.white} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalDescription}>
              Add a product you sell regularly. It will appear as a quick-tap button on this screen.
            </Text>

            <Text style={styles.modalLabel}>NARAN / NAME</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Telkomsel $1"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={styles.modalLabel}>PRESU / PRICE</Text>
            <Text style={styles.modalHint}>The selling price per unit</Text>
            <View style={styles.priceRow}>
              <Text style={styles.pricePrefix}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={newPrice}
                onChangeText={setNewPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.modalLabel}>KATEGORIA (optional)</Text>
            <Text style={styles.modalHint}>Group similar products together</Text>
            <TextInput
              style={styles.modalInput}
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="e.g. Pulsa, Makanan, Rokok"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  gridContainer: { flex: 1 },
  gridContent: { padding: 12, paddingBottom: 100 },
  gridHint: { fontSize: 11, color: colors.textTertiary, marginBottom: 10, paddingHorizontal: 4 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  productCard: {
    width: '47.5%', backgroundColor: colors.bgCard, borderRadius: 10, padding: 16,
    borderWidth: 0.5, borderColor: colors.border, minHeight: 96,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  productCardActive: { borderColor: colors.primary, borderWidth: 1, backgroundColor: colors.primaryGlow },
  productCardDisabled: { opacity: 0.35 },
  productName: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 4, letterSpacing: -0.2 },
  productNameDisabled: { color: colors.textTertiary },
  productPrice: { fontSize: 17, fontWeight: '800', color: colors.moneyIn, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  productPriceDisabled: { color: colors.textTertiary },
  productStock: { fontSize: 10, color: colors.textTertiary, marginTop: 4, fontWeight: '500', letterSpacing: 0.2 },
  cartBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.primary, borderRadius: 4, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  cartBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },

  cartBar: { backgroundColor: colors.bgCard, borderTopWidth: 0.5, borderTopColor: colors.borderMedium, paddingBottom: 8 },
  cartItems: { maxHeight: 60, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  cartItemsContent: { paddingHorizontal: 12, gap: 6, paddingVertical: 8 },
  cartItem: { backgroundColor: colors.bgElevated, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartItemName: { fontSize: 12, fontWeight: '600', color: colors.text, maxWidth: 72, letterSpacing: -0.1 },
  cartItemQty: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { width: 22, height: 22, borderRadius: 4, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 13, fontWeight: '700', color: colors.text, minWidth: 14, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cartItemTotal: { fontSize: 12, fontWeight: '700', color: colors.moneyIn, fontVariant: ['tabular-nums'], letterSpacing: -0.2 },

  cartFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  clearBtn: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.moneyOutBg, alignItems: 'center', justifyContent: 'center' },
  cartTotalWrap: { flex: 1 },
  cartTotalLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: '500' },
  cartTotalAmount: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  cartVatHint: { fontSize: 9, color: colors.textTertiary },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.moneyIn, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 8 },
  checkoutText: { fontSize: 15, fontWeight: '700', color: colors.textInverse, letterSpacing: 0.3 },

  fab: { position: 'absolute', bottom: 24, right: 20, width: 52, height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  emptySubtext: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.bgCard, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  modalHeaderBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  modalSaveBtn: { backgroundColor: colors.primary },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center', letterSpacing: -0.2 },
  modalBody: { padding: 20 },
  modalDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  modalLabel: { fontSize: 10, fontWeight: '700', color: colors.textTertiary, marginBottom: 4, marginTop: 20, letterSpacing: 1.5 },
  modalHint: { fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
  modalInput: { backgroundColor: colors.bgCard, borderRadius: 8, borderWidth: 0.5, borderColor: colors.borderMedium, padding: 14, fontSize: 15, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 8, borderWidth: 0.5, borderColor: colors.borderMedium, paddingHorizontal: 14 },
  pricePrefix: { fontSize: 20, fontWeight: '300', color: colors.textTertiary, marginRight: 4 },
  priceInput: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, paddingVertical: 14, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
});
