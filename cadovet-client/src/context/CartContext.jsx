import React, { createContext, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addItem,
  clearCart as clearCartAction,
  clearToast,
  closeBookingModal as closeBookingModalAction,
  openBookingModal as openBookingModalAction,
  removeItem,
  selectCartCount,
  selectCartItems,
  selectCartTotal,
  setCartOpen,
  setQuantity,
  showToast as showToastAction
} from '../store/cartSlice';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const cartCount = useSelector(selectCartCount);
  const cartTotal = useSelector(selectCartTotal);
  const toastMessage = useSelector((state) => state.cart.toastMessage);
  const isCartOpen = useSelector((state) => state.cart.isCartOpen);
  const bookingModalItem = useSelector((state) => state.cart.bookingModalItem);

  const showToast = (msg) => {
    dispatch(showToastAction(msg));
    window.setTimeout(() => dispatch(clearToast()), 3500);
  };

  const addToCart = (item) => {
    dispatch(addItem(item));
    window.setTimeout(() => dispatch(clearToast()), 3500);
  };

  const removeFromCart = (idOrSlug) => dispatch(removeItem(idOrSlug));

  const updateQuantity = (idOrSlug, qty) => {
    dispatch(setQuantity({ itemKey: idOrSlug, quantity: qty }));
  };

  const clearCart = () => {
    dispatch(clearCartAction());
  };

  const setIsCartOpen = (isOpen) => dispatch(setCartOpen(isOpen));

  const openBookingModal = (item) => dispatch(openBookingModalAction(item));

  const closeBookingModal = () => dispatch(closeBookingModalAction());

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      cartCount,
      cartTotal,
      toastMessage,
      showToast,
      isCartOpen,
      setIsCartOpen,
      bookingModalItem,
      openBookingModal,
      closeBookingModal
    }}>
      {children}
      {/* Global Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 999999,
          background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
          color: '#fff',
          padding: '14px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          fontSize: '14px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'fadeInDown 0.3s ease'
        }}>
          <span style={{ fontSize: '18px' }}>✓</span> {toastMessage}
        </div>
      )}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
