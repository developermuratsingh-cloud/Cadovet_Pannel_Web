-- Blog posts for the website and mobile app.
-- Seed content is the articles published on the Cado Vet website (cadovet-client/src/constants/cadovetCatalog.js).
CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(150) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(80) NOT NULL,
    author VARCHAR(120),
    excerpt TEXT,
    content TEXT NOT NULL,
    image_url VARCHAR(500),
    read_minutes INTEGER DEFAULT 3,
    published_at DATE DEFAULT CURRENT_DATE,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at DESC);

INSERT INTO blog_posts (slug, title, category, author, excerpt, content, image_url, read_minutes, published_at) VALUES
($b$pet-needs-a-vet$b$, $b$10 Common Signs Your Pet Needs a Vet Visit Immediately$b$, $b$Pet Health$b$, $b$Dr. Ambesh Kumar Pandey$b$, $b$As a devoted pet parent, ensuring your furry friend’s health and happiness is always top priority. However, pets often hide their pain instinctively...$b$, $b$As a devoted pet parent, ensuring your furry friend’s health and happiness is always a top priority. However, pets can’t speak to tell us when they are feeling sick or uncomfortable. Many animals, especially cats and dogs, instinctively mask their symptoms until an illness has progressed significantly.

Here are 10 subtle and overt signs that you should never ignore:
1. Changes in Appetite or Sudden Weight Loss: Refusing meals for more than 24 hours or unexplained drastic weight drops often indicate underlying organ dysfunction.
2. Lethargy or Extreme Reluctance to Play: When an energetic pet suddenly sleeps all day or hides under furniture, it is usually a distress signal.
3. Excessive Thirst and Increased Urination: These are classic signs of diabetes mellitus, kidney disease, or Cushing's disease.
4. Persistent Vomiting or Diarrhea: Occasional stomach upsets happen, but repeated vomiting or bloody stool demands immediate veterinary attention.
5. Difficulty Breathing or Persistent Coughing: Wheezing, rapid shallow breaths, or heavy panting while resting requires emergency care.
6. Limping, Stiffness, or Reluctance to Jump: Common in developing hip dysplasia, arthritis, or cruciate ligament injuries.
7. Cloudy Eyes or Excessive Eye Discharge: Eye infections can worsen rapidly and jeopardize vision if left untreated.
8. Unpleasant Odors from Mouth or Ears: Foul breath often indicates severe periodontal disease, while smelly ears suggest bacterial or yeast ear infections.
9. Persistent Scratching, Biting, or Hair Loss: Usually caused by fleas, mites, fungal ringworm, or severe allergic dermatitis.
10. Behavioral Changes like Sudden Aggression: When a sweet pet snaps when touched, it is almost always reacting to acute localized pain.

If you observe any of these symptoms, don't wait. Cadovet offers convenient doorstep veterinary consultations across Delhi, Noida, and Ghaziabad to treat your pet in the stress-free comfort of home.$b$, $b$https://cadovet.com/wp-content/uploads/2025/03/veterinarians-shutterstock_1479238910-1024x667-1-300x300.jpg$b$, 4, '2025-03-14'),
($b$pet-first-aid-kit$b$, $b$How to Build an Emergency First Aid Kit for Your Pet$b$, $b$Emergency Care$b$, $b$Dr. Varsha$b$, $b$As a responsible pet owner, being prepared for emergencies is crucial. A dedicated pet first aid kit ensures you can stabilize injuries before reaching the hospital...$b$, $b$Accidents, bee stings, minor cuts, and sudden ingestions can happen anytime. Having a well-stocked pet first aid kit in your home or car can make all the difference while you prepare to transport your pet or await a home-visit veterinarian.

Essential items every pet first aid kit must contain:
1. Sterile Gauze Pads and Self-Adhesive Bandages: Non-stick wound dressings and Vet Wrap that won't stick to pet fur.
2. Antiseptic Solution: Povidone-iodine (Betadine) or Chlorhexidine solution for cleaning cuts without stinging. Never use alcohol or hydrogen peroxide on open deep wounds.
3. Digital Rectal Thermometer & Water-Soluble Lubricant: A pet's normal temperature is between 101.0°F and 102.5°F. Anything above 104°F or below 99°F is critical.
4. Blunt-Tipped Bandage Scissors: Safe for cutting hair and bandages without accidentally puncturing pet skin.
5. Tweezers or Tick Removal Tool: Specifically designed to grab ticks near the head without squeezing dangerous vector fluids into the pet.
6. Saline Eye Wash: For flushing dirt, dust, and pollen out of irritated eyes.
7. Activated Charcoal Gel: Keep this on hand only after consulting your veterinarian in cases of accidental poisoning.
8. Emergency Vet Contact Numbers: Cadovet 24x7 Helpline (+91 922 041 0777) written prominently on the kit lid.

Remember: First aid is not a substitute for professional veterinary care. It is a critical bridge to keep your pet stable and pain-free.$b$, $b$https://cadovet.com/wp-content/uploads/2025/04/first-aid-kit-billi-300x300.jpg$b$, 5, '2025-03-10'),
($b$spaying-and-neutering$b$, $b$Spaying and Neutering: Proven Benefits for Your Pet’s Lifelong Health$b$, $b$Surgery & Wellness$b$, $b$Dr. Ambesh Kumar Pandey$b$, $b$Spaying and neutering are routine medical procedures that help control pet homelessness while extending your pet’s life span significantly...$b$, $b$Spaying (for females) and neutering (for males) are among the most compassionate and health-boosting choices a pet parent can make. Medical research consistently shows that sterilized pets live longer, healthier, and calmer lives.

Top Health Benefits for Female Dogs and Cats:
- Eliminates the risk of Pyometra: A life-threatening bacterial uterine infection that affects up to 25% of unspayed female dogs.
- Drastically reduces Mammary Cancer: Spaying before the first heat cycle reduces the risk of mammary tumors to less than 0.5%.
- Eliminates Heat Cycles: No more blood spotting, restless pacing, or male dogs congregating around your house.

Top Health Benefits for Male Dogs and Cats:
- Prevents Testicular Cancer and Prostate Disorders: Neutering completely eliminates testicular cancer and minimizes benign prostatic hyperplasia.
- Reduces Urge to Roam: Intact males will dig fences, cross busy highways, and fight other males in search of a mate.
- Curbing Urine Marking and Aggression: Neutered pets are significantly less likely to territorial mark indoors or pick fights.

At Cadovet, our surgeons perform safe, sterile, minimally invasive spay and neuter procedures with advanced monitoring, multimodal analgesia, and thorough post-op home care.$b$, $b$https://cadovet.com/wp-content/uploads/2024/12/care-pets-after-surgery-min-1024x683-removebg-preview.png$b$, 6, '2025-03-05'),
($b$professional-grooming$b$, $b$Why Professional Pet Grooming is Far Superior to DIY Home Bathing$b$, $b$Grooming$b$, $b$Dr. Ashish Bangad$b$, $b$Grooming is about much more than a shiny coat and pleasant fragrance; it is a vital healthcare checkup for skin, paws, ears, and sanitary hygiene...$b$, $b$While giving your dog a splash in the bathroom might seem easy, professional grooming is a comprehensive wellness check and hygiene treatment that requires specialized tools and expertise.

Key Differences in Professional Grooming:
1. Safe Ear Cleaning and Plucking: Pet ears collect bacteria, yeast, and excess wax. Professional groomers gently clean deep within the ear canal to prevent chronic otitis.
2. Painless Nail Trimming: Cutting into the 'quick' of a pet's nail causes bleeding and fear. Professional groomers know the exact angle to cut or file safely.
3. Medicated & Coat-Specific Shampoos: Human shampoos strip the acidic lipid barrier of canine skin. Groomers choose dermatologically balanced formulas for anti-fungal, anti-dandruff, or soothing oat therapy.
4. Detection of Hidden Parasites & Lumps: While blowing out the coat with high-velocity dryers, groomers inspect every square inch of skin, discovering ticks, hot spots, cysts, or early skin tumors before they spread.
5. Sanitary and Paw Pad Trimming: Keeping sanitary areas trimmed prevents fecal soiling, while clearing paw pad hair prevents slipping on tiled floors.

Cadovet brings luxury mobile and in-home grooming right to your door, eliminating the car ride stress and keeping your pet relaxed.$b$, $b$https://cadovet.com/wp-content/uploads/2025/03/pet-grooming-300x300.png$b$, 4, '2025-02-28'),
($b$pet-health-guide$b$, $b$Common Pet Diseases in India and Practical Prevention Strategies$b$, $b$Preventive Medicine$b$, $b$Dr. Saeeda Khanam$b$, $b$Our pets bring boundless joy, but India’s tropical climate exposes them to parvo, tick fever, distemper, and heat stroke...$b$, $b$India's climate creates unique veterinary challenges, with high humidity fostering ticks, mosquitoes, and viral pathogens. Fortunately, almost all major infectious diseases are 100% preventable with timely vaccination and hygiene.

1. Canine Parvovirus (CPV): Extremely contagious and hardy in the environment. Causes bloody diarrhea, vomiting, and dehydration in puppies. Prevention: 3-shot puppy vaccination course (DHPPi).
2. Canine Distemper (CDV): Attacks the respiratory, gastrointestinal, and nervous systems, leading to muscle twitches and seizures. Prevention: Routine vaccination.
3. Tick Fever (Ehrlichiosis / Babesiosis): Spread by brown dog ticks, this destroys platelets and red blood cells. Prevention: Monthly anti-tick spot-on treatments and periodic 4DX panel tests.
4. Feline Panleukopenia (Cat Distemper): High mortality virus in kittens causing bone marrow suppression. Prevention: Feline Tri-Cat (FVRCP) core vaccine.
5. Rabies: Fatal zoonotic virus transmissible to humans. Prevention: Annual anti-rabies vaccination is mandatory by law.

Protect your pet before diseases strike. Schedule your pet’s annual immunization with Cadovet’s doorstep vaccination team.$b$, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1.png$b$, 5, '2025-02-22'),
($b$dogs-and-cats-diet$b$, $b$🥗 Healthy Diet & Nutrition Guide for Dogs and Cats$b$, $b$Nutrition$b$, $b$Dr. Saeeda Khanam$b$, $b$A well-balanced diet is the cornerstone of longevity, energy, and radiant coat health. Understand exact caloric and nutritional needs...$b$, $b$Nutrition isn't one-size-fits-all. Puppies require high protein and calcium for skeletal growth, adult pets need balanced energy to prevent obesity, and senior pets need joint support supplements like glucosamine and omega-3 fatty acids.

Key Guidelines:
- Dogs are Omnivores with Carnivorous bias: They thrive on quality animal protein, complex carbohydrates like pumpkin and brown rice, and healthy fats.
- Cats are Obligate Carnivores: Cats cannot synthesize essential amino acids like Taurine and Arginine; they must derive them strictly from animal meat. Never feed a vegetarian diet to a feline.
- Toxic Foods to strictly avoid: Chocolate, onions, garlic, grapes, raisins, xylitol artificial sweetener, cooked bird bones, and alcohol.
- Fresh Clean Water: Ensure multiple bowls of clean filtered water are accessible, especially for cats prone to urinary crystals.$b$, $b$https://cadovet.com/wp-content/uploads/2024/12/Untitled-design-1-1-300x300.png$b$, 5, '2025-02-15'),
($b$pet-aggression$b$, $b$Why Is My Pet Acting Aggressive? Root Causes & Proven Solutions$b$, $b$Behavior & Training$b$, $b$Dr. Ashish Bangad$b$, $b$Growling, snapping, or defensive posturing can be frightening. Understand why aggression stems from pain or fear, and how to resolve it...$b$, $b$Aggression in dogs and cats is almost never random spite. It is a form of communication when the animal feels threatened, frightened, or in physical agony.

Top Causes:
1. Undiagnosed Medical Pain: An animal with dental abscesses, ear mites, arthritis, or spinal trauma will snap when touched in tender spots. A full vet checkup should always be the first step.
2. Fear-Based Reactivity: Dogs that lacked early socialization between 3-14 weeks of age often view strangers or unfamiliar dogs as predators.
3. Resource Guarding: Possessiveness over food bowls, chew bones, or sleeping spots.
4. Hormonal Drives: Intact male dogs competing for females. Neutering often reduces this tension considerably.

Never punish a growling dog—a growl is a warning that prevents an actual bite. Instead, consult a veterinarian to rule out pain, and work with a positive-reinforcement behaviorist.$b$, $b$https://cadovet.com/wp-content/uploads/2025/03/Untitled-design-300x300.png$b$, 5, '2025-02-10')
ON CONFLICT (slug) DO NOTHING;
