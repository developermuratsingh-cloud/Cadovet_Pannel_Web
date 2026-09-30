import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchPublicDoctors, fetchPublicServices, fetchPublicServicesByCategory } from '../services/publicApi';

// The services table has no image column, so a real service never has service.image. Pick a stand-in that at
// least matches what kind of visit it is, instead of one hardcoded photo repeated on every card.
const FALLBACK_SERVICE_IMAGES = {
  consultation: 'https://cadovet.com/wp-content/uploads/2025/03/Untitled-design-300x300.png',
  vaccinationA: 'https://cadovet.com/wp-content/uploads/2024/11/Puppy-Vaccination-Pack-300x300.png',
  checkup: 'https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1.png',
  vaccinationB: 'https://cadovet.com/wp-content/uploads/2024/12/Puppy-Vaccination-Pack-1-300x300.png',
  homeVisit: 'https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1-1-300x300.png',
  grooming: 'https://cadovet.com/wp-content/uploads/2025/03/pet-grooming-300x300.png',
  surgery: 'https://cadovet.com/wp-content/uploads/2024/12/care-pets-after-surgery-min-1024x683-removebg-preview.png'
};
const FALLBACK_SERVICE_IMAGE_CYCLE = Object.values(FALLBACK_SERVICE_IMAGES);

const pickFallbackServiceImage = (service, index) => {
  const text = `${service.name || ''} ${service.category || ''}`.toLowerCase();
  if (text.includes('groom')) return FALLBACK_SERVICE_IMAGES.grooming;
  if (text.includes('surg') || text.includes('spay') || text.includes('neuter')) return FALLBACK_SERVICE_IMAGES.surgery;
  if (text.includes('vaccin')) return index % 2 === 0 ? FALLBACK_SERVICE_IMAGES.vaccinationA : FALLBACK_SERVICE_IMAGES.vaccinationB;
  if (text.includes('checkup') || text.includes('diagnos') || text.includes('ultrasound') || text.includes('dental')) return FALLBACK_SERVICE_IMAGES.checkup;
  if (text.includes('home visit') || text.includes('doorstep')) return FALLBACK_SERVICE_IMAGES.homeVisit;
  if (text.includes('consult')) return FALLBACK_SERVICE_IMAGES.consultation;
  return FALLBACK_SERVICE_IMAGE_CYCLE[index % FALLBACK_SERVICE_IMAGE_CYCLE.length];
};

const normalizeService = (service, index) => ({
  ...service,
  slug: service.slug || `service-${service.id}`,
  title: service.title || service.name,
  shortDesc: service.shortDesc || service.description,
  image: service.image || service.image_url || pickFallbackServiceImage(service, index),
  // Marketing fields the panel now manages alongside the basics — undefined/null on an older or
  // admin-created-minimal service just means a page renders without that particular embellishment.
  originalPrice: service.originalPrice ?? (service.original_price != null ? Number(service.original_price) : undefined),
  badge: service.badge || undefined,
  rating: service.rating != null ? Number(service.rating) : undefined,
  reviewsCount: service.reviewsCount ?? service.reviews_count ?? undefined,
  inclusions: service.inclusions || undefined,
  price: Number(service.price)
});

export const loadPublicServices = createAsyncThunk('catalog/loadServices', async () => {
  const services = await fetchPublicServices();
  return services.map(normalizeService);
});

export const loadPublicServicesByCategory = createAsyncThunk('catalog/loadServicesByCategory', async (category) => {
  const services = await fetchPublicServicesByCategory(category);
  return services.map(normalizeService);
});

export const loadPublicDoctors = createAsyncThunk('catalog/loadDoctors', async () => fetchPublicDoctors());

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: {
    services: [],
    doctors: [],
    status: 'idle',
    error: null,
    categoryStatus: 'idle',
    categoryError: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPublicServices.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadPublicServices.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.services = action.payload;
      })
      .addCase(loadPublicServices.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Unable to load services';
      })
      .addCase(loadPublicServicesByCategory.pending, (state) => {
        state.categoryStatus = 'loading';
        state.categoryError = null;
      })
      .addCase(loadPublicServicesByCategory.fulfilled, (state, action) => {
        state.categoryStatus = 'succeeded';
        state.services = action.payload;
      })
      .addCase(loadPublicServicesByCategory.rejected, (state, action) => {
        state.categoryStatus = 'failed';
        state.categoryError = action.error.message || 'Unable to load services';
      })
      .addCase(loadPublicDoctors.fulfilled, (state, action) => {
        state.doctors = action.payload;
      });
  }
});

export const selectServices = (state) => state.catalog.services;
export const selectDoctors = (state) => state.catalog.doctors;
export const selectCatalogStatus = (state) => state.catalog.status;
export const selectCategoryCatalogStatus = (state) => state.catalog.categoryStatus;
export const selectCatalogError = (state) => state.catalog.error;
export const selectCategoryCatalogError = (state) => state.catalog.categoryError;

export default catalogSlice.reducer;
