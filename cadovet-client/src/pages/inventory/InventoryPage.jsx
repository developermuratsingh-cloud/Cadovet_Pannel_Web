import React from 'react';
import StockPage from './StockPage';

const CATEGORIES = ['FOOD', 'ACCESSORY', 'GROOMING', 'OTHER'];

const InventoryPage = () => (
  <StockPage
    department="INVENTORY"
    title="Inventory"
    subtitle="Pet food, belts, e-collars, muzzles, and general supplies — the Inventory desk's own stock"
    icon="📦"
    categories={CATEGORIES}
    itemNoun="Item"
  />
);

export default InventoryPage;
