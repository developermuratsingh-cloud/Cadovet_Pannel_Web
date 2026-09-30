-- Records (documents), coupons, membership offers and referrals for the mobile app.

-- 1. Customer documents: prescriptions, lab reports, vaccination certificates and anything else the customer uploads.
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('PRESCRIPTION', 'LAB_REPORT', 'VACCINATION', 'OTHER')),
    title VARCHAR(120) NOT NULL,
    notes TEXT,
    original_name VARCHAR(255),
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id, category);

-- 2. Coupons. Seed = the two codes the website accepts today (cadovet-client CartPage.jsx): 10% off.
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    discount_type VARCHAR(10) NOT NULL DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'FLAT')),
    discount_value NUMERIC(10,2) NOT NULL,
    min_amount NUMERIC(10,2) DEFAULT 0,
    max_discount NUMERIC(10,2),
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO coupons (code, title, description, discount_type, discount_value) VALUES
('WELCOME10', 'Welcome offer', '10% discount for new pet parents.', 'PERCENT', 10),
('CADO10', 'Cadovet 10% off', '10% discount on your booking.', 'PERCENT', 10)
ON CONFLICT (code) DO NOTHING;

-- 3. Referrals: every user can have a shareable code; a friend who signs up with it is linked to the referrer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(12) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 4. A coupon can be applied to a booking; the server computes and records the discount.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(30);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- 5. Membership offers. Seed = the discounted health packages published on the Cado Vet website
--    (cadovet-client/src/constants/cadovetCatalog.js: DOG_PACKAGES, CAT_PACKAGES).
CREATE TABLE IF NOT EXISTS membership_offers (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(120) UNIQUE NOT NULL,
    title VARCHAR(160) NOT NULL,
    subtitle VARCHAR(200),
    pet_type VARCHAR(10) NOT NULL DEFAULT 'Dogs',
    price NUMERIC(10,2) NOT NULL,
    original_price NUMERIC(10,2),
    badge VARCHAR(40),
    description TEXT,
    inclusions JSONB NOT NULL DEFAULT '[]',
    image_url VARCHAR(500),
    rating NUMERIC(3,2),
    reviews_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO membership_offers (slug, title, subtitle, pet_type, price, original_price, badge, description, inclusions, image_url, rating, reviews_count, sort_order) VALUES
($b$puppy-vaccination-package$b$, $b$Puppy Vaccination Package$b$, $b$Complete 3-Shot Immunization Bundle$b$, $b$Dogs$b$, 5999, 6999, $b$Most Popular$b$, $b$Complete 3-stage puppy vaccination schedule: DHPPi, Corona, Anti-Rabies, Parvo+CD, plus digital health card & doorstep visit.$b$, $b$["3 Shots of DHPPi Core Vaccine", "2 Shots of Coronavirus Vaccine", "2 Shots of Anti-Rabies (ARV)", "1 Shot of Kennel Cough Protection", "Doorstep Home Visit by certified Veterinarian", "Official Pet Vaccination Booklet & Digital Records"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Puppy-Vaccination-Pack-1-300x300.png$b$, 5, 42, 0),
($b$adult-dog-vaccination-package$b$, $b$Adult Dog Vaccination Package$b$, $b$Annual Preventive Booster Protocol$b$, $b$Dogs$b$, 3399, 3699, $b$Sale!$b$, $b$Annual comprehensive health checkup with core booster shots to safeguard adult canines from deadly infectious diseases.$b$, $b$["1 Shot of 9-in-1 DHPPiL Booster", "1 Shot of Coronavirus Vaccine", "1 Shot of Anti-Rabies Vaccine", "1 Shot of Kennel Cough (Oral/Injectable)", "General Physical Examination", "Deworming Consultation"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/11/Puppy-Vaccination-Pack-300x300.png$b$, 4.9, 38, 1),
($b$anti-rabies$b$, $b$Anti Rabies Vaccine (Dog)$b$, $b$Essential Government Mandated Protection$b$, $b$Dogs$b$, 899, 1100, $b$Essential$b$, $b$Protects dogs and their human families from fatal rabies infection. Certified administration with vaccination tag.$b$, $b$["1 Dose of Licensed Rabies Vaccine", "Certified In-Home Administration", "Veterinary Vitals Check", "Digital Rabies Certificate"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1.png$b$, 5, 56, 2),
($b$dhppi$b$, $b$DHPPi (7-in-1 / 9-in-1) Vaccine$b$, $b$Protection against Distemper, Hepatitis & Parvo$b$, $b$Dogs$b$, 1399, 1600, $b$Core Shot$b$, $b$Protects dogs against Distemper, Hepatitis, Parvovirus, and Parainfluenza with high antibody titre efficacy.$b$, $b$["1 Dose of High-Efficacy DHPPi Vaccine", "Cold-chain maintained delivery to your home", "Pre-vaccine Temperature & Health Check", "Post-vaccine observation"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1-1-300x300.png$b$, 4.8, 29, 3),
($b$kennel-cough$b$, $b$Kennel Cough Vaccine$b$, $b$Respiratory Defense for Dogs$b$, $b$Dogs$b$, 1499, 1750, $b$Recommended$b$, $b$Guards dogs against Bordetella bronchiseptica, the primary causative agent of infectious tracheobronchitis.$b$, $b$["1 Shot / Intra-nasal Bordetella Vaccine", "Respiratory Assessment by Vet", "Stress-free at-home application"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2025/03/Untitled-design-300x300.png$b$, 4.9, 21, 4),
($b$corona-vaccination$b$, $b$Canine Corona Vaccination$b$, $b$Intestinal Protection for Puppies & Dogs$b$, $b$Dogs$b$, 1299, 1500, $b$Core Care$b$, $b$Specialized immunization against Canine Coronavirus (CCoV) preventing severe gastrointestinal distress and dehydration.$b$, $b$["1 Shot of Canine Corona Vaccine", "Doorstep Cold-Chain Delivery", "Vet Evaluation"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Puppy-Vaccination-Pack-1-300x300.png$b$, 4.8, 19, 5),
($b$parvo-cd$b$, $b$Parvo + CD (Puppy DP)$b$, $b$Early Life Emergency Shield$b$, $b$Dogs$b$, 1499, 1800, $b$Critical$b$, $b$Administered at 4-6 weeks of age to confer immediate active immunity against Canine Parvovirus and Distemper virus.$b$, $b$["1 Shot of High-Titred Puppy DP Vaccine", "Gentle pediatric vet handling", "New pet parent guidance handbook"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/11/Puppy-Vaccination-Pack-300x300.png$b$, 5, 45, 6),
($b$tick-treatment$b$, $b$Tick & Flea Treatment (Dog)$b$, $b$Complete Parasite Eradication$b$, $b$Dogs$b$, 2499, 2999, $b$Wellness$b$, $b$Comprehensive topical and systemic anti-tick therapy, eliminating ticks, fleas, mites, and preventing tick fever.$b$, $b$["Full body coat & skin inspection for tick infestation", "Veterinary-grade spot-on or systemic administration", "Anti-tick spray and tick combing", "Tick fever risk assessment"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1.png$b$, 4.9, 33, 7),
($b$kitten-vaccination-pack$b$, $b$Kitten Vaccination Package$b$, $b$Full 2-Stage Kitten Protocol$b$, $b$Cats$b$, 3599, 4200, $b$Best Value$b$, $b$Complete immunization series for kittens from 8 weeks: Tri-cat (FVRCP) core vaccines plus Rabies and wellness checks.$b$, $b$["2 Shots of Tri-Cat (FVRCP Core Feline Vaccine)", "2 Shots of Anti-Rabies (ARV)", "At-home feline-friendly veterinarian visit", "Kitten health card & deworming guide"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/11/Puppy-Vaccination-Pack-300x300.png$b$, 5, 27, 8),
($b$adult-cat-vaccination-package$b$, $b$Adult Cat Vaccination Package$b$, $b$Annual Feline Defense Booster$b$, $b$Cats$b$, 1999, 2400, $b$Popular$b$, $b$Annual booster package protecting mature cats from Panleukopenia, Calicivirus, Rhinotracheitis, and Rabies.$b$, $b$["1 Shot of Feline Tri-Cat (CRP) Booster", "1 Shot of Anti-Rabies Vaccine", "Full Feline Physical Checkup", "Dental & Coat Assessment"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1-1-300x300.png$b$, 4.9, 31, 9),
($b$anti-rabies-vaccination-cat$b$, $b$Anti-Rabies Vaccination (Cat)$b$, $b$Safe Feline Rabies Shield$b$, $b$Cats$b$, 899, 1100, $b$Essential$b$, $b$Gentle, low-stress rabies immunization for cats and kittens administered by trained feline handling vets.$b$, $b$["1 Shot of Adjuvant-Free Rabies Vaccine", "Feline stress-reducing gentle handling", "Certified Vaccination Certificate"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1.png$b$, 5, 22, 10),
($b$trick-treatment-cat$b$, $b$Tick & Flea Treatment (Cat)$b$, $b$Safe Feline Parasite Control$b$, $b$Cats$b$, 1599, 1999, $b$Specialized$b$, $b$Safe, cat-specific anti-parasitic treatment (free of harmful permethrins) that eradicates fleas, ticks, and earmites.$b$, $b$["Cat-safe spot-on application", "Ear mite inspection & cleaning", "Skin irritation soothing treatment"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2025/03/Untitled-design-300x300.png$b$, 4.8, 18, 11),
($b$feline-crptri-cat-vaccine$b$, $b$Feline CRP (Tri-Cat) Vaccine$b$, $b$Core Defense: Panleukopenia, Calici, Rhino$b$, $b$Cats$b$, 1499, 1800, $b$Core Vaccine$b$, $b$Essential protection against feline distemper (panleukopenia) and upper respiratory viral infections.$b$, $b$["1 Dose of Tri-Cat FVRCP Vaccine", "Temperature, mucous membrane and lymph node check", "Doorstep veterinary service"]$b$::jsonb, $b$https://cadovet.com/wp-content/uploads/2024/12/Puppy-Vaccination-Pack-1-300x300.png$b$, 4.9, 24, 12)
ON CONFLICT (slug) DO NOTHING;
