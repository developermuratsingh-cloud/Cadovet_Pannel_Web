import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const translations = {
  en: {
    home: 'Home',
    about: 'About Us',
    blog: 'Blog',
    contact: 'Contact Us',
    userLogin: 'Login',
    myAccount: 'My Account',
    searchPlaceholder: 'Search vaccines, surgery, grooming, doctors...',
    clinics: 'Clinical Services',
    emergency: 'Emergency & Online Consultation',
    search: 'Search',
    cart: 'Cart',
    items: 'Items',
    helpline: 'Helpline',
    dark: 'Dark',
    light: 'Light',
    dogs: 'Dogs',
    cats: 'Cats',
    services: 'Services',
    vaccination: 'Vaccination',
    bestSelling: 'Our Best Selling Packages',
    doctors: 'Meet Our Expert Doctors',
    theme: 'Theme',
    language: 'Language',
    homeTitle: 'Home Pet Healthcare Services',
    homeDescription: 'Cadovet health care for your pet with our veterinary services, bringing expert care right to your doorstep.',
    bookHomeVisit: 'Book Home Visit',
    affordableConsultation: 'Affordable consultation anytime',
    quickBooking: 'Quick, easy, and flexible booking',
    qualifiedVeterinarians: 'Qualified veterinarians providing personalized attention and care for your pets',
    followUpSupport: 'Follow-up support and digital health tracking',
    happyPetsTreated: 'Happy Pet Parents',
    homeVisitsDone: 'Pets Vaccinated',
    vaccinationsGiven: 'Paws Served',
    ownerName: 'Owner Name',
    phoneNumber: 'Phone Number',
    petSpecies: 'Pet Species',
    concerns: 'Concerns',
    date: 'Date',
    timeSlot: 'Time Slot',
    address: 'Address',
    bookHomeVisitNow: 'Book Home Visit Now',
    visitRequested: 'Visit Requested!',
    bookAnotherVisit: 'Book Another Visit',
    topHealthcareSolutions: 'Top Healthcare Solutions',
    bestSellingDescription: 'Certified veterinary packages chosen by pet parents across Delhi NCR',
    qualifiedVeterinariansLabel: 'Qualified Veterinarians',
    doctorsDescription: 'Meet our experts and get personalized guidance for your pet health and well-being.',
    clearAnswers: 'Clear Answers',
    frequentlyAskedQuestions: 'Frequently Asked Questions',
    recentGuides: 'Recent Blogs',
    petWellnessKnowledge: 'Pet Wellness and Knowledge',
    readFullArticle: 'Read Full Article',
    popular: 'Popular',
    recommended: 'Recommended',
    wellness: 'Wellness',
    coreCare: 'Core Care',
    bestValue: 'Best Value',
    coreShots: 'Core and non-core shots',
    consultation: 'Consultation',
    onlineDoorstep: 'Online and doorstep visits',
    labTests: 'Lab Tests',
    bloodDiagnostics: 'Complete blood and diagnostics',
    healthCheckup: 'Health Checkup',
    preventativeWellness: 'Preventative wellness',
    grooming: 'Grooming',
    bathsStyling: 'Baths, styling and hygiene',
    addToCart: 'Cart',
    bookVisit: 'Book Visit',
    paymentMethodsQuestion: 'What payment methods are accepted?',
    paymentMethodsAnswer: 'We accept UPI, credit card, debit card, net banking, and offline cash upon completion.',
    cancellationQuestion: 'What is your cancellation policy?',
    cancellationAnswer: 'You may cancel or reschedule your booking at no charge up to 2 hours before the appointment.',
    groomingQuestion: 'How long does a grooming session take?',
    groomingAnswer: 'A grooming session typically takes between 1 and 3 hours depending on your pet coat, breed, and temperament.',
    unhappyQuestion: 'What if I am unhappy after the service?',
    unhappyAnswer: 'We provide review and refund support if you are unsatisfied with the care received.'
    ,welcomeCadovet: 'Welcome to Cadovet'
    ,aboutHeroTitle: 'Dedicated Pet Healthcare and Veterinary Excellence'
    ,aboutHeroDescription: 'Bringing expert veterinary medical care, certified vaccinations, diagnostics, and professional grooming directly to your doorstep.'
    ,whoWeAre: 'Who We Are'
    ,aboutTitle: 'About Cadovet Pet Care'
    ,aboutParagraphOne: 'At Cadovet, we are dedicated to building a global community that celebrates the joy and companionship of dogs and cats. Our mission is to support pet owners with resources that make caring for their furry friends easier and more fulfilling.'
    ,aboutParagraphTwo: 'We offer educational resources, inspiring stories, and practical clinical guidelines to help you provide the best care for your pet. Whether you need advice, emergency care, or preventive checkups, our platform empowers you as a pet parent.'
    ,aboutQuote: 'At Cadovet, we share your unconditional love for animals. Every woof and every purr is a reason to smile!'
    ,guidingPrinciples: 'Guiding Principles and Commitments'
    ,guidingDescription: 'What drives our team every day to provide standard-setting pet healthcare.'
    ,ourVision: 'Our Vision'
    ,visionText: 'To build a worldwide community that connects pet parents through shared love for their companions. We make pet care simpler, accessible, and high quality through doorstep veterinary visits and modern telemedicine.'
    ,ourMission: 'Our Mission'
    ,missionText: 'Be a compassionate advocate for animals. Deliver reliable vaccinations, safe surgical interventions, and preventive wellness so pets lead long, joyful lives.'
    ,ourGoal: 'Our Goal'
    ,goalText: 'Provide every pet with safe, gentle, and nurturing healthcare. Unite certified veterinarians and compassionate pet parents to create a trusted home veterinary network.'
    ,meetFounders: 'Meet the Founders'
    ,leadershipTitle: 'Leadership Behind Cadovet'
    ,leadershipDescription: 'Passionate entrepreneurs and animal healthcare advocates dedicated to transforming veterinary services.'
    ,healthWellnessJournal: 'Cadovet Health and Wellness Journal'
    ,blogTitle: 'Pet Parenting Guides and Veterinary Advice'
    ,blogDescription: 'Read clinical insights, disease prevention tips, first-aid manuals, and nutrition advice written by certified veterinary professionals.'
    ,allArticles: 'All Articles'
    ,readArticle: 'Read Full Article'
    ,verifiedByVet: 'Verified by Vet'
    ,by: 'By'
    ,needAdvice: 'Need Personalized Advice for Your Pet?'
    ,bookCheckup: 'Book an in-home veterinarian checkup across Delhi NCR for just ₹599.'
    ,callNow: 'Call Now'
    ,veterinaryPreventiveCare: 'Veterinary preventive care at home'
    ,felineHomeCare: 'Gentle feline-friendly home care'
    ,dogPackagesTitle: 'Dogs Vaccination Packages and Protocols'
    ,catPackagesTitle: 'Cat Vaccination Packages and Wellness'
    ,catalogDescription: 'Choose active veterinary services from Cadovet and book a qualified veterinary visit at home.'
    ,allCare: 'All care'
    ,completeBundles: 'Complete bundles'
    ,singleServices: 'Single services'
    ,loadingServices: 'Loading available services...'
    ,servicesUnavailable: 'Services are temporarily unavailable. Please try again shortly.'
    ,noServices: 'No active services are currently available.'
    ,contactEyebrow: 'We are here for your pet 24x7'
    ,contactTitle: 'Contact Cadovet Pet Care'
    ,contactDescription: 'Have a question about doorstep vaccinations, surgical consultation, lab tests, or grooming? Reach our veterinary care team anytime.'
    ,getInTouch: 'Get in Touch'
    ,emergencyCenters: 'Emergency Helplines and Doorstep Service Centers'
    ,contactSupportDescription: 'Our mobile veterinary doctors and customer support coordinators operate round the clock across Delhi NCR.'
    ,supportEmail: 'Support Email'
    ,serviceHubs: 'Service Hubs'
    ,sendMessage: 'Send Us a Message'
    ,messageDescription: 'Fill out the form below and our medical coordinators will contact you shortly.'
    ,messageSent: 'Message Sent!'
    ,sendAnother: 'Send Another Message'
    ,yourName: 'Your Name'
    ,mobileNumber: 'Mobile Number'
    ,cityLocation: 'City / Location'
    ,emailAddress: 'Email Address'
    ,howHelp: 'How can we help your pet?'
    ,sendMessageAction: 'Send Message to Cadovet'
    ,welcomeBack: 'Welcome Back'
    ,signInAccount: 'Sign in to your Cadovet account'
    ,password: 'Password'
    ,enterPassword: 'Enter your password'
    ,forgotPassword: 'Forgot password?'
    ,signingIn: 'Signing In...'
    ,signIn: 'Sign In'
    ,noAccount: "Don't have an account?"
    ,createAccount: 'Create Account'
    ,registerAccount: 'Register Your Pet Care Account'
    ,createAccountDescription: 'Create your account and get access to premium veterinary services for your beloved pet.'
    ,fullName: 'Full Name'
    ,createPassword: 'Create a strong password'
    ,confirmPassword: 'Confirm Password'
    ,repeatPassword: 'Repeat your password'
    ,creatingAccount: 'Creating Account...'
    ,createMyAccount: 'Create My Account'
    ,alreadyAccount: 'Already have an account?'
    ,signInLink: 'Sign In'
    ,backToLogin: 'Back to Login'
    ,vaccinationEyebrow: 'Need vaccination at home?'
    ,vaccinationTitle: 'Doorstep Pet Vaccinations and Immunization'
    ,vaccinationDescription: 'Get your dog or cat vaccinated at home with certified cold-chain immunizations, health booklets, and post-shot monitoring.'
    ,dogVaccinations: 'Dog Vaccinations'
    ,catVaccinations: 'Cat Vaccinations'
    ,vaccinesIncluded: 'Vaccines Included'
    ,packagePrice: 'Package Price'
    ,bookNow: 'Book Now'
    ,vaccinationFaqs: 'Vaccination FAQs'
    ,vaccinationFaqDescription: 'Everything you need to know about preparing for your pet vaccination at home.'
    ,allServicesCatalog: 'All Services Catalog'
    ,majorMinorSurgery: 'Major-Minor Surgery'
    ,dogVaccinationPackages: 'Dog Vaccination Packages'
    ,catVaccinationPackages: 'Cat Vaccination Packages'
    ,dogGroomingSpa: 'Dog Grooming and Spa'
    ,homeVisitConsultation: 'Home Visit Consultation'
    ,comprehensiveLabTests: 'Comprehensive Lab Tests'
    ,fullHealthCheckup: 'Full Health Checkup'
    ,viewDogPackages: 'View All Dog Packages'
    ,viewCatPackages: 'View All Cat Packages'
    ,petHealthCategory: 'Pet Health'
    ,emergencyCareCategory: 'Emergency Care'
    ,surgeryWellnessCategory: 'Surgery and Wellness'
    ,preventiveMedicineCategory: 'Preventive Medicine'
    ,nutritionCategory: 'Nutrition'
    ,behaviorTrainingCategory: 'Behavior and Training'
    ,blogPost1Title: '10 Common Signs Your Pet Needs a Vet Visit Immediately'
    ,blogPost1Excerpt: 'Learn the warning signs that mean your pet needs veterinary attention without delay.'
    ,blogPost2Title: 'How to Build an Emergency First Aid Kit for Your Pet'
    ,blogPost2Excerpt: 'Prepare a practical first aid kit to help stabilize your pet during an emergency.'
    ,blogPost3Title: 'Spaying and Neutering: Proven Benefits for Lifelong Health'
    ,blogPost3Excerpt: 'Understand the health and wellbeing benefits of responsible spaying and neutering.'
    ,blogPost4Title: 'Why Professional Pet Grooming Is Better Than Home Bathing'
    ,blogPost4Excerpt: 'Professional grooming supports coat, skin, paw, ear, and overall pet health.'
    ,blogPost5Title: 'Common Pet Diseases in India and Prevention Strategies'
    ,blogPost5Excerpt: 'Learn how vaccination, hygiene, and timely care can prevent common pet diseases.'
    ,blogPost6Title: 'Healthy Diet and Nutrition Guide for Dogs and Cats'
    ,blogPost6Excerpt: 'Understand the essential nutrition needs of dogs and cats at every life stage.'
    ,blogPost7Title: 'Why Is My Pet Acting Aggressive? Causes and Solutions'
    ,blogPost7Excerpt: 'Explore the medical, fear, resource, and hormonal causes behind pet aggression.'
  },
  hi: {
    home: 'होम',
    about: 'हमारे बारे में',
    blog: 'ब्लॉग',
    contact: 'संपर्क करें',
    userLogin: 'उपयोगकर्ता लॉगिन',
    myAccount: 'मेरा खाता',
    search: 'खोजें',
    cart: 'कार्ट',
    items: 'आइटम',
    helpline: 'हेल्पलाइन',
    dark: 'डार्क',
    light: 'लाइट',
    dogs: 'कुत्ते',
    cats: 'बिल्लियां',
    services: 'सेवाएं',
    vaccination: 'टीकाकरण',
    searchPlaceholder: 'वैक्सीन, सर्जरी, ग्रूमिंग, डॉक्टर खोजें...',
    clinics: 'क्लिनिकल सेवाएं',
    emergency: 'आपातकालीन और ऑनलाइन परामर्श',
    bestSelling: 'हमारे बेस्ट सेलिंग पैकेज',
    doctors: 'हमारे विशेषज्ञ डॉक्टर',
    theme: 'थीम',
    language: 'भाषा',
    homeTitle: 'घर पर पालतू स्वास्थ्य सेवाएं',
    homeDescription: 'कैडोवेट की पशु चिकित्सा सेवाओं के साथ अपने पालतू जानवर की देखभाल करें और विशेषज्ञ सहायता अपने घर पर पाएं।',
    bookHomeVisit: 'घर पर विजिट बुक करें',
    affordableConsultation: 'किफायती परामर्श कभी भी',
    quickBooking: 'तेज, आसान और सुविधाजनक बुकिंग',
    qualifiedVeterinarians: 'योग्य पशु चिकित्सक आपके पालतू जानवर को व्यक्तिगत देखभाल देते हैं',
    followUpSupport: 'फॉलो-अप सहायता और डिजिटल स्वास्थ्य ट्रैकिंग',
    happyPetsTreated: 'खुश पालतू अभिभावक',
    homeVisitsDone: 'टीकाकरण किए गए पालतू जानवर',
    vaccinationsGiven: 'सेवा प्राप्त पंजे',
    ownerName: 'मालिक का नाम',
    phoneNumber: 'फोन नंबर',
    petSpecies: 'पालतू जानवर की प्रजाति',
    concerns: 'समस्या',
    date: 'तारीख',
    timeSlot: 'समय',
    address: 'पता',
    bookHomeVisitNow: 'अभी घर पर विजिट बुक करें',
    visitRequested: 'विजिट का अनुरोध भेजा गया!',
    bookAnotherVisit: 'एक और विजिट बुक करें',
    topHealthcareSolutions: 'शीर्ष स्वास्थ्य सेवाएं',
    bestSellingDescription: 'दिल्ली एनसीआर के पालतू अभिभावकों द्वारा चुने गए प्रमाणित पशु चिकित्सा पैकेज',
    qualifiedVeterinariansLabel: 'योग्य पशु चिकित्सक',
    doctorsDescription: 'हमारे विशेषज्ञों से मिलें और अपने पालतू जानवर के लिए व्यक्तिगत सलाह पाएं।',
    clearAnswers: 'स्पष्ट उत्तर',
    frequentlyAskedQuestions: 'अक्सर पूछे जाने वाले प्रश्न',
    recentGuides: 'हाल के ब्लॉग',
    petWellnessKnowledge: 'पालतू स्वास्थ्य और जानकारी',
    readFullArticle: 'पूरा लेख पढ़ें',
    popular: 'लोकप्रिय',
    recommended: 'अनुशंसित',
    wellness: 'स्वास्थ्य',
    coreCare: 'मुख्य देखभाल',
    bestValue: 'सर्वोत्तम मूल्य',
    coreShots: 'मुख्य और अतिरिक्त टीके',
    consultation: 'परामर्श',
    onlineDoorstep: 'ऑनलाइन और घर पर विजिट',
    labTests: 'लैब टेस्ट',
    bloodDiagnostics: 'पूर्ण रक्त जांच और डायग्नोस्टिक्स',
    healthCheckup: 'स्वास्थ्य जांच',
    preventativeWellness: 'निवारक स्वास्थ्य देखभाल',
    grooming: 'ग्रूमिंग',
    bathsStyling: 'नहाना, स्टाइलिंग और स्वच्छता',
    addToCart: 'कार्ट',
    bookVisit: 'विजिट बुक करें',
    paymentMethodsQuestion: 'कौन से भुगतान तरीके स्वीकार किए जाते हैं?',
    paymentMethodsAnswer: 'हम यूपीआई, क्रेडिट कार्ड, डेबिट कार्ड, नेट बैंकिंग और सेवा के बाद नकद भुगतान स्वीकार करते हैं।',
    cancellationQuestion: 'रद्द करने की नीति क्या है?',
    cancellationAnswer: 'आप अपॉइंटमेंट से 2 घंटे पहले बिना शुल्क बुकिंग रद्द या रीशेड्यूल कर सकते हैं।',
    groomingQuestion: 'ग्रूमिंग सेशन में कितना समय लगता है?',
    groomingAnswer: 'पालतू जानवर के कोट, नस्ल और स्वभाव के अनुसार ग्रूमिंग में आमतौर पर 1 से 3 घंटे लगते हैं।',
    unhappyQuestion: 'सेवा से संतुष्ट न होने पर क्या होगा?',
    unhappyAnswer: 'देखभाल से असंतुष्ट होने पर हम समीक्षा और रिफंड सहायता प्रदान करते हैं।'
    ,welcomeCadovet: 'कैडोवेट में आपका स्वागत है'
    ,aboutHeroTitle: 'समर्पित पालतू स्वास्थ्य और पशु चिकित्सा उत्कृष्टता'
    ,aboutHeroDescription: 'विशेषज्ञ पशु चिकित्सा देखभाल, प्रमाणित टीकाकरण, डायग्नोस्टिक्स और प्रोफेशनल ग्रूमिंग आपके घर तक।'
    ,whoWeAre: 'हम कौन हैं'
    ,aboutTitle: 'कैडोवेट पालतू देखभाल के बारे में'
    ,aboutParagraphOne: 'कैडोवेट में हम कुत्तों और बिल्लियों के साथ जीवन की खुशी और साथ को मनाने वाला वैश्विक समुदाय बनाने के लिए समर्पित हैं। हमारा उद्देश्य पालतू अभिभावकों को ऐसी जानकारी देना है जिससे देखभाल आसान और बेहतर बने।'
    ,aboutParagraphTwo: 'हम शैक्षिक संसाधन, प्रेरक कहानियां और व्यावहारिक चिकित्सा दिशानिर्देश देते हैं ताकि आप अपने पालतू जानवर की सर्वोत्तम देखभाल कर सकें।'
    ,aboutQuote: 'कैडोवेट में हम जानवरों के लिए आपके निस्वार्थ प्रेम को समझते हैं। हर भौंक और हर म्याऊ मुस्कुराने की वजह है!'
    ,guidingPrinciples: 'मार्गदर्शक सिद्धांत और प्रतिबद्धताएं'
    ,guidingDescription: 'हर दिन बेहतर पालतू स्वास्थ्य सेवा देने की प्रेरणा।'
    ,ourVision: 'हमारा दृष्टिकोण'
    ,visionText: 'ऐसा वैश्विक समुदाय बनाना जो पालतू अभिभावकों को जोड़ता हो और घर पर पशु चिकित्सा व आधुनिक टेलीमेडिसिन से देखभाल सरल, सुलभ और गुणवत्तापूर्ण बनाता हो।'
    ,ourMission: 'हमारा मिशन'
    ,missionText: 'जानवरों के संवेदनशील साथी बनना और विश्वसनीय टीकाकरण, सुरक्षित सर्जरी तथा निवारक स्वास्थ्य सेवा देना।'
    ,ourGoal: 'हमारा लक्ष्य'
    ,goalText: 'हर पालतू जानवर को सुरक्षित, कोमल और पोषण देने वाली स्वास्थ्य सेवा देना तथा एक विश्वसनीय घरेलू पशु चिकित्सा नेटवर्क बनाना।'
    ,meetFounders: 'संस्थापकों से मिलें'
    ,leadershipTitle: 'कैडोवेट का नेतृत्व'
    ,leadershipDescription: 'पशु स्वास्थ्य सेवाओं को बदलने के लिए समर्पित उद्यमी और पशु कल्याण समर्थक।'
    ,healthWellnessJournal: 'कैडोवेट स्वास्थ्य और कल्याण पत्रिका'
    ,blogTitle: 'पालतू देखभाल गाइड और पशु चिकित्सा सलाह'
    ,blogDescription: 'प्रमाणित पशु चिकित्सा विशेषज्ञों द्वारा लिखी गई चिकित्सा जानकारी, रोग रोकथाम, प्राथमिक उपचार और पोषण सलाह पढ़ें।'
    ,allArticles: 'सभी लेख'
    ,readArticle: 'पूरा लेख पढ़ें'
    ,verifiedByVet: 'पशु चिकित्सक द्वारा सत्यापित'
    ,by: 'द्वारा'
    ,needAdvice: 'अपने पालतू के लिए व्यक्तिगत सलाह चाहिए?'
    ,bookCheckup: 'दिल्ली एनसीआर में केवल ₹599 में घर पर पशु चिकित्सक जांच बुक करें।'
    ,callNow: 'अभी कॉल करें'
    ,veterinaryPreventiveCare: 'घर पर पशु चिकित्सा निवारक देखभाल'
    ,felineHomeCare: 'बिल्लियों के लिए कोमल घरेलू देखभाल'
    ,dogPackagesTitle: 'कुत्तों के टीकाकरण पैकेज और प्रोटोकॉल'
    ,catPackagesTitle: 'बिल्लियों के टीकाकरण पैकेज और स्वास्थ्य सेवा'
    ,catalogDescription: 'कैडोवेट की सक्रिय पशु चिकित्सा सेवाएं चुनें और योग्य डॉक्टर की घर पर विजिट बुक करें।'
    ,allCare: 'सभी सेवाएं'
    ,completeBundles: 'पूर्ण पैकेज'
    ,singleServices: 'एकल सेवाएं'
    ,loadingServices: 'उपलब्ध सेवाएं लोड हो रही हैं...'
    ,servicesUnavailable: 'सेवाएं अभी उपलब्ध नहीं हैं। कृपया कुछ देर बाद फिर प्रयास करें।'
    ,noServices: 'अभी कोई सक्रिय सेवा उपलब्ध नहीं है।'
    ,contactEyebrow: 'हम आपके पालतू के लिए 24x7 उपलब्ध हैं'
    ,contactTitle: 'कैडोवेट पालतू देखभाल से संपर्क करें'
    ,contactDescription: 'घर पर टीकाकरण, सर्जरी, लैब टेस्ट या ग्रूमिंग के बारे में प्रश्न है? हमारी पशु चिकित्सा टीम से कभी भी संपर्क करें।'
    ,getInTouch: 'संपर्क करें'
    ,emergencyCenters: 'आपातकालीन हेल्पलाइन और घर पर सेवा केंद्र'
    ,contactSupportDescription: 'हमारे मोबाइल पशु चिकित्सक और सहायता समन्वयक दिल्ली एनसीआर में चौबीसों घंटे उपलब्ध हैं।'
    ,supportEmail: 'सहायता ईमेल'
    ,serviceHubs: 'सेवा केंद्र'
    ,sendMessage: 'हमें संदेश भेजें'
    ,messageDescription: 'नीचे फॉर्म भरें और हमारे चिकित्सा समन्वयक जल्द आपसे संपर्क करेंगे।'
    ,messageSent: 'संदेश भेज दिया गया!'
    ,sendAnother: 'एक और संदेश भेजें'
    ,yourName: 'आपका नाम'
    ,mobileNumber: 'मोबाइल नंबर'
    ,cityLocation: 'शहर / स्थान'
    ,emailAddress: 'ईमेल पता'
    ,howHelp: 'हम आपके पालतू की कैसे मदद कर सकते हैं?'
    ,sendMessageAction: 'कैडोवेट को संदेश भेजें'
    ,welcomeBack: 'वापसी पर स्वागत है'
    ,signInAccount: 'अपने कैडोवेट खाते में साइन इन करें'
    ,password: 'पासवर्ड'
    ,enterPassword: 'अपना पासवर्ड दर्ज करें'
    ,forgotPassword: 'पासवर्ड भूल गए?'
    ,signingIn: 'साइन इन हो रहा है...'
    ,signIn: 'साइन इन'
    ,noAccount: 'खाता नहीं है?'
    ,createAccount: 'खाता बनाएं'
    ,registerAccount: 'अपना पालतू देखभाल खाता बनाएं'
    ,createAccountDescription: 'खाता बनाएं और अपने पालतू के लिए बेहतरीन पशु चिकित्सा सेवाएं पाएं।'
    ,fullName: 'पूरा नाम'
    ,createPassword: 'मजबूत पासवर्ड बनाएं'
    ,confirmPassword: 'पासवर्ड की पुष्टि करें'
    ,repeatPassword: 'पासवर्ड फिर से दर्ज करें'
    ,creatingAccount: 'खाता बनाया जा रहा है...'
    ,createMyAccount: 'मेरा खाता बनाएं'
    ,alreadyAccount: 'पहले से खाता है?'
    ,signInLink: 'साइन इन'
    ,backToLogin: 'लॉगिन पर वापस जाएं'
    ,vaccinationEyebrow: 'घर पर टीकाकरण चाहिए?'
    ,vaccinationTitle: 'घर पर पालतू टीकाकरण और प्रतिरक्षण'
    ,vaccinationDescription: 'प्रमाणित कोल्ड-चेन टीकाकरण, स्वास्थ्य पुस्तिका और टीके के बाद निगरानी के साथ अपने कुत्ते या बिल्ली का टीकाकरण घर पर कराएं।'
    ,dogVaccinations: 'कुत्तों का टीकाकरण'
    ,catVaccinations: 'बिल्लियों का टीकाकरण'
    ,vaccinesIncluded: 'शामिल टीके'
    ,packagePrice: 'पैकेज मूल्य'
    ,bookNow: 'अभी बुक करें'
    ,vaccinationFaqs: 'टीकाकरण के सामान्य प्रश्न'
    ,vaccinationFaqDescription: 'घर पर पालतू टीकाकरण की तैयारी के बारे में जरूरी जानकारी।'
    ,allServicesCatalog: 'सभी सेवाओं की सूची'
    ,majorMinorSurgery: 'बड़ी और छोटी सर्जरी'
    ,dogVaccinationPackages: 'कुत्तों के टीकाकरण पैकेज'
    ,catVaccinationPackages: 'बिल्लियों के टीकाकरण पैकेज'
    ,dogGroomingSpa: 'कुत्तों की ग्रूमिंग और स्पा'
    ,homeVisitConsultation: 'घर पर परामर्श'
    ,comprehensiveLabTests: 'पूर्ण लैब टेस्ट'
    ,fullHealthCheckup: 'पूर्ण स्वास्थ्य जांच'
    ,viewDogPackages: 'सभी कुत्ते पैकेज देखें'
    ,viewCatPackages: 'सभी बिल्ली पैकेज देखें'
    ,petHealthCategory: 'पालतू स्वास्थ्य'
    ,emergencyCareCategory: 'आपातकालीन देखभाल'
    ,surgeryWellnessCategory: 'सर्जरी और स्वास्थ्य'
    ,preventiveMedicineCategory: 'निवारक चिकित्सा'
    ,nutritionCategory: 'पोषण'
    ,behaviorTrainingCategory: 'व्यवहार और प्रशिक्षण'
    ,blogPost1Title: '10 संकेत कि आपके पालतू को तुरंत पशु चिकित्सक की जरूरत है'
    ,blogPost1Excerpt: 'जानें वे चेतावनी संकेत जिनमें आपके पालतू को तुरंत पशु चिकित्सा सहायता चाहिए।'
    ,blogPost2Title: 'अपने पालतू के लिए आपातकालीन प्राथमिक उपचार किट कैसे बनाएं'
    ,blogPost2Excerpt: 'आपात स्थिति में अपने पालतू को स्थिर रखने के लिए उपयोगी प्राथमिक उपचार किट तैयार करें।'
    ,blogPost3Title: 'नसबंदी के लाभ: जीवनभर बेहतर स्वास्थ्य'
    ,blogPost3Excerpt: 'जिम्मेदार नसबंदी के स्वास्थ्य और कल्याण लाभों को समझें।'
    ,blogPost4Title: 'प्रोफेशनल पेट ग्रूमिंग घर पर नहलाने से बेहतर क्यों है'
    ,blogPost4Excerpt: 'प्रोफेशनल ग्रूमिंग त्वचा, कोट, पंजे, कान और समग्र स्वास्थ्य की देखभाल करती है।'
    ,blogPost5Title: 'भारत में सामान्य पालतू रोग और बचाव की रणनीतियां'
    ,blogPost5Excerpt: 'जानें कि टीकाकरण, स्वच्छता और समय पर देखभाल सामान्य रोगों को कैसे रोकती है।'
    ,blogPost6Title: 'कुत्तों और बिल्लियों के लिए स्वस्थ आहार और पोषण गाइड'
    ,blogPost6Excerpt: 'हर जीवन चरण में कुत्तों और बिल्लियों की जरूरी पोषण आवश्यकताओं को समझें।'
    ,blogPost7Title: 'मेरा पालतू आक्रामक क्यों हो रहा है? कारण और समाधान'
    ,blogPost7Excerpt: 'पालतू आक्रामकता के पीछे चिकित्सा, डर, संसाधन और हार्मोनल कारण जानें।'
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    return localStorage.getItem('cadovet-language') || 'en';
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key) => translations[language]?.[key] || key,
    availableLanguages: Object.keys(translations)
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
};
