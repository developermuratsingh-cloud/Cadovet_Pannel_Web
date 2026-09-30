import React from 'react';
import StockPage from '../inventory/StockPage';

const CATEGORIES = ['MEDICINE', 'VACCINE', 'SURGICAL', 'SUPPLEMENT', 'CONSUMABLE'];

const PharmacyPage = () => (
  <StockPage
    department="MEDICINE"
    title="Pharmacy"
    subtitle="Medicines, vaccines, and surgical supplies — the Pharmacy desk's own stock"
    icon="💊"
    categories={CATEGORIES}
    itemNoun="Medicine / Supply"
  />
);

export default PharmacyPage;
