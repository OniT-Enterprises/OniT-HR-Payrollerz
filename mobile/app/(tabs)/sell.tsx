/**
 * Kaixa — POS / Quick Sell Screen (Faan)
 *
 * Product grid with big tap-to-add buttons.
 * Cart at bottom, checkout creates a Money In transaction.
 * Dark theme, Tetum-first labels.
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
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
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

// ============================================
// Types
// ============================================

interface CartItem {
  product: Product;
  qty: number;
}

// ============================================
// Component
// ============================================

export default function SellScreen() {
  const { tenantId } = useTenantStore();
  const { user } = useAuthStore();
  const {
    products,
    loading,
    loadProducts,
    activeProducts,
    decrementStock,
    updateProduct,
    deleteProduct,
  } = useProductStore();
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

  // Edit product modal state
  const [editProductModal, setEditProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [newStock, setNewStock] = useState('');

  const vatActive = isVATActive();
  const vatRate = effectiveRate();

  useEffect(() => {
    if (tenantId) {
      loadProducts(tenantId);
    }
  }, [tenantId, loadProducts]);

  const active = activeProducts();

  // ── Cart operations ──────────────────────────

  const addToCart = useCallback(
    (product: Product) => {
      // Check stock
      if (product.stock !== null && product.stock <= 0) {
        Alert.alert('Stoke esgota', `${product.name} has no stock left`);
        return;
      }

      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          // Check stock limit
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

  // ── Checkout ─────────────────────────────────

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

      // Decrement stock for items that track it
      for (const item of cart) {
        if (item.product.stock !== null) {
          await decrementStock(tenantId, item.product.id, item.qty);
        }
      }

      // Generate receipt with sequential number
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

      // Offer to share receipt
      Alert.alert(
        'Susesu!',
        `$${cartTotal.toFixed(2)} — ${itemNames}`,
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Share',
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

  // ── Add Product ──────────────────────────────

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

    const stockVal = newStock.trim();
    const stock = stockVal === '' ? null : parseInt(stockVal, 10);
    if (stock !== null && (isNaN(stock) || stock < 0)) {
      Alert.alert('Error', 'Stock must be 0 or more, or leave empty for unlimited');
      return;
    }

    setSaving(true);
    try {
      await useProductStore.getState().addProduct(tenantId, {
        name: newName.trim(),
        price: Math.round(price * 100) / 100,
        category: newCategory.trim(),
        stock,
      });
      setAddProductModal(false);
      setNewName('');
      setNewPrice('');
      setNewCategory('');
      setNewStock('');
    } catch {
      Alert.alert('Error', 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit Product ────────────────────────────

  const openEditModal = (product: Product) => {
    setEditProduct(product);
    setEditName(product.name);
    setEditPrice(product.price.toString());
    setEditCategory(product.category);
    setEditStock(product.stock !== null ? product.stock.toString() : '');
    setEditActive(product.isActive);
    setEditProductModal(true);
  };

  const handleEditProduct = async () => {
    if (!editProduct || !tenantId) return;

    const price = parseFloat(editPrice);
    if (!editName.trim()) {
      Alert.alert('Error', 'Enter a product name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Enter a valid price');
      return;
    }

    const stockVal = editStock.trim();
    const stock = stockVal === '' ? null : parseInt(stockVal, 10);
    if (stock !== null && (isNaN(stock) || stock < 0)) {
      Alert.alert('Error', 'Stock must be 0 or more, or leave empty for unlimited');
      return;
    }

    setSaving(true);
    try {
      await updateProduct(tenantId, editProduct.id, {
        name: editName.trim(),
        price: Math.round(price * 100) / 100,
        category: editCategory.trim(),
        isActive: editActive,
        stock,
      });
      setEditProductModal(false);
      setEditProduct(null);
    } catch {
      Alert.alert('Error', 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = () => {
    if (!editProduct || !tenantId) return;

    Alert.alert(
      'Hamoos Produtu',
      `Delete "${editProduct.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from cart if present
              setCart((prev) =>
                prev.filter((item) => item.product.id !== editProduct.id)
              );
              await deleteProduct(tenantId, editProduct.id);
              setEditProductModal(false);
              setEditProduct(null);
            } catch {
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  // ── Render ───────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Product Grid */}
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
                size={32}
                color={colors.textTertiary}
                strokeWidth={1.5}
              />
            </View>
            <Text style={styles.emptyText}>Seidauk iha produtu</Text>
            <Text style={styles.emptySubtext}>
              Tap + to add products for quick selling
            </Text>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {active.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              const outOfStock =
                product.stock !== null && product.stock <= 0;
              const lowStock =
                product.stock !== null &&
                product.stock > 0 &&
                product.stock <= 5;

              return (
                <TouchableOpacity
                  key={product.id}
                  style={[
                    styles.productCard,
                    inCart && styles.productCardActive,
                    lowStock && styles.productCardLowStock,
                    outOfStock && styles.productCardDisabled,
                  ]}
                  onPress={() => !outOfStock && addToCart(product)}
                  onLongPress={() => openEditModal(product)}
                  activeOpacity={outOfStock ? 1 : 0.7}
                >
                  {/* Edit hint icon */}
                  <View style={styles.editHint}>
                    <Pencil
                      size={10}
                      color={colors.textTertiary}
                      strokeWidth={2}
                    />
                  </View>

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
                    <View style={styles.stockRow}>
                      {lowStock && (
                        <AlertTriangle
                          size={11}
                          color={colors.warning}
                          strokeWidth={2.5}
                        />
                      )}
                      <Text
                        style={[
                          styles.productStock,
                          outOfStock && { color: colors.error },
                          lowStock && { color: colors.warning },
                        ]}
                      >
                        {outOfStock
                          ? 'Esgota'
                          : `${product.stock} iha`}
                      </Text>
                    </View>
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
        )}
      </ScrollView>

      {/* Cart Bar */}
      {cart.length > 0 && (
        <View style={styles.cartBar}>
          {/* Cart items (scrollable) */}
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
                    <Minus
                      size={14}
                      color={colors.error}
                      strokeWidth={2.5}
                    />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity
                    onPress={() => updateQty(item.product.id, 1)}
                    style={styles.qtyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Plus
                      size={14}
                      color={colors.moneyIn}
                      strokeWidth={2.5}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.cartItemTotal}>
                  ${(item.product.price * item.qty).toFixed(2)}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Cart footer */}
          <View style={styles.cartFooter}>
            <TouchableOpacity
              onPress={clearCart}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={colors.error} strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.cartTotalWrap}>
              <Text style={styles.cartTotalLabel}>
                {cartItemCount} item{cartItemCount !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.cartTotalAmount}>
                ${cartTotal.toFixed(2)}
              </Text>
              {vatActive && cartTotal > 0 && (
                <Text style={styles.cartVatHint}>
                  incl. VAT {vatRate}%
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
                  <ShoppingBag
                    size={18}
                    color={colors.white}
                    strokeWidth={2}
                  />
                  <Text style={styles.checkoutText}>Selu</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* FAB — Add Product */}
      <TouchableOpacity
        style={[styles.fab, cart.length > 0 && { bottom: 180 }]}
        onPress={() => {
          setNewName('');
          setNewPrice('');
          setNewCategory('');
          setNewStock('');
          setAddProductModal(true);
        }}
        activeOpacity={0.85}
      >
        <Plus size={28} color={colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Add Product Modal */}
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
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Produtu Foun</Text>
            <TouchableOpacity
              onPress={handleAddProduct}
              style={styles.modalHeaderBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={20} color={colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
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
            <TextInput
              style={styles.modalInput}
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="e.g. Pulsa, Makanan, Rokok"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.modalLabel}>STOKE / STOCK (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={newStock}
              onChangeText={setNewStock}
              placeholder="Leave empty for unlimited"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal
        visible={editProductModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditProductModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setEditProductModal(false)}
              style={styles.modalHeaderBtn}
            >
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edita Produtu</Text>
            <TouchableOpacity
              onPress={handleEditProduct}
              style={styles.modalHeaderBtn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Check size={20} color={colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>NARAN / NAME</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Product name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={styles.modalLabel}>PRESU / PRICE</Text>
            <View style={styles.priceRow}>
              <Text style={styles.pricePrefix}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={editPrice}
                onChangeText={setEditPrice}
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={styles.modalLabel}>KATEGORIA (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={editCategory}
              onChangeText={setEditCategory}
              placeholder="e.g. Pulsa, Makanan, Rokok"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.modalLabel}>STOKE / STOCK (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={editStock}
              onChangeText={setEditStock}
              placeholder="Leave empty for unlimited"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
            />

            {/* Active toggle */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setEditActive(!editActive)}
              activeOpacity={0.7}
            >
              <View style={styles.toggleLabel}>
                <Text style={styles.toggleText}>Ativu / Active</Text>
                <Text style={styles.toggleHint}>
                  {editActive
                    ? 'Visible in POS'
                    : 'Hidden from POS'}
                </Text>
              </View>
              {editActive ? (
                <ToggleRight
                  size={32}
                  color={colors.success}
                  strokeWidth={1.5}
                />
              ) : (
                <ToggleLeft
                  size={32}
                  color={colors.textTertiary}
                  strokeWidth={1.5}
                />
              )}
            </TouchableOpacity>

            {/* Delete button */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteProduct}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={colors.error} strokeWidth={2} />
              <Text style={styles.deleteBtnText}>Hamoos Produtu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Grid
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    padding: 12,
    paddingBottom: 100,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  // Product Card
  productCard: {
    width: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(224, 141, 107, 0.08)',
  },
  productCardLowStock: {
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  productCardDisabled: {
    opacity: 0.4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  productNameDisabled: {
    color: colors.textTertiary,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.moneyIn,
    fontVariant: ['tabular-nums'],
  },
  productPriceDisabled: {
    color: colors.textTertiary,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  productStock: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  editHint: {
    position: 'absolute',
    top: 8,
    left: 8,
    opacity: 0.4,
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },

  // Cart Bar
  cartBar: {
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 8,
  },
  cartItems: {
    maxHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  cartItemsContent: {
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 8,
  },
  cartItem: {
    backgroundColor: colors.bgElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    maxWidth: 80,
  },
  cartItemQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    minWidth: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  cartItemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.moneyIn,
    fontVariant: ['tabular-nums'],
  },

  // Cart Footer
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartTotalWrap: {
    flex: 1,
  },
  cartTotalLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  cartTotalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  cartVatHint: {
    fontSize: 10,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.moneyIn,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    marginBottom: 8,
    marginTop: 20,
    letterSpacing: 1,
  },
  modalInput: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  pricePrefix: {
    fontSize: 20,
    fontWeight: '300',
    color: colors.textTertiary,
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 14,
    fontVariant: ['tabular-nums'],
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 20,
  },
  toggleLabel: {
    flex: 1,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  toggleHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Delete button
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
    padding: 14,
    marginTop: 32,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
});
