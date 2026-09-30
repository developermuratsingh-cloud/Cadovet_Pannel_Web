import { createSlice } from '@reduxjs/toolkit';

const loadCart = () => {
  try {
    const saved = localStorage.getItem('cadovet_cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const getItemKey = (item) => item.id ?? item.slug;

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: loadCart(),
    toastMessage: '',
    isCartOpen: false,
    bookingModalItem: null
  },
  reducers: {
    addItem: (state, action) => {
      const item = action.payload;
      const itemKey = getItemKey(item);
      const existing = state.items.find((current) => getItemKey(current) === itemKey);
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
      } else {
        state.items.push({ ...item, qty: 1 });
      }
      state.toastMessage = `🛒 "${item.title || item.name}" added to cart!`;
    },
    removeItem: (state, action) => {
      state.items = state.items.filter((item) => getItemKey(item) !== action.payload);
      state.toastMessage = 'Item removed from cart';
    },
    setQuantity: (state, action) => {
      const { itemKey, quantity } = action.payload;
      const item = state.items.find((current) => getItemKey(current) === itemKey);
      if (!item) return;
      if (quantity <= 0) {
        state.items = state.items.filter((current) => getItemKey(current) !== itemKey);
        return;
      }
      item.qty = quantity;
    },
    clearCart: (state) => {
      state.items = [];
    },
    showToast: (state, action) => {
      state.toastMessage = action.payload;
    },
    clearToast: (state) => {
      state.toastMessage = '';
    },
    setCartOpen: (state, action) => {
      state.isCartOpen = action.payload;
    },
    openBookingModal: (state, action) => {
      state.bookingModalItem = action.payload;
    },
    closeBookingModal: (state) => {
      state.bookingModalItem = null;
    }
  }
});

export const {
  addItem,
  removeItem,
  setQuantity,
  clearCart,
  showToast,
  clearToast,
  setCartOpen,
  openBookingModal,
  closeBookingModal
} = cartSlice.actions;

export const selectCartItems = (state) => state.cart.items;
export const selectCartCount = (state) => state.cart.items.reduce((count, item) => count + (item.qty || 1), 0);
export const selectCartTotal = (state) => state.cart.items.reduce((total, item) => total + (parseFloat(item.price || 0) * (item.qty || 1)), 0);

export default cartSlice.reducer;
