import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice';
import catalogReducer from './catalogSlice';

export const store = configureStore({
  reducer: {
    cart: cartReducer,
    catalog: catalogReducer
  }
});

store.subscribe(() => {
  try {
    localStorage.setItem('cadovet_cart', JSON.stringify(store.getState().cart.items));
  } catch {
    // Storage is optional, so private browsing should not break the app.
  }
});

export default store;
