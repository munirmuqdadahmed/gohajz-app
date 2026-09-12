/* ==========================================
   📅 GoHajz Core - منصة الحجوزات
   ==========================================
   يوفّر:
   - تسجيل/دخول أصحاب الصالونات (مزوّدي الخدمة)
   - تسجيل دخول مجهول شفاف للزبائن (يسمح لهم يحجزون بدون حساب كامل)
   - دوال جاهزة للتعامل مع بيانات كل صالون (خدمات، أوقات دوام، حجوزات)
*/

// 🔴 إعدادات مشروع Firebase: gohajz-app
const firebaseConfig = {
    apiKey:            "AIzaSyCAhIcWjkAOfnC88VPN7iseDwb4hwQskOo",
    authDomain:        "gohajz-app.firebaseapp.com",
    projectId:         "gohajz-app",
    storageBucket:     "gohajz-app.firebasestorage.app",
    messagingSenderId: "446386366546",
    appId:             "1:446386366546:web:c37ca9d2ae8a8e3394d78b",
    measurementId:     "G-P0EDYMVVBT"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// معرّف الصالون الحالي (لصاحب الصالون بعد تسجيل الدخول)
function getCurrentProviderId() {
    return localStorage.getItem('gohajz_provider_id') || null;
}
function setCurrentProviderId(id) {
    localStorage.setItem('gohajz_provider_id', id);
}
function clearCurrentProviderId() {
    localStorage.removeItem('gohajz_provider_id');
}

// ==========================================
// 🏪 تسجيل صالون جديد (صاحب العمل)
// ==========================================
async function signUpProvider(email, password, providerName, category, phone, city) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    const providerRef = db.collection('providers').doc();
    await providerRef.set({
        name:        providerName,
        category:    category,   // "رجالي" / "نسائي" / "عيادة" ...
        ownerUid:    uid,
        phone:       phone || '',
        city:        city || '',
        description: '',
        logoUrl:     '',
        coverUrl:    '',
        isActive:    true,
        createdAt:   Date.now(),
        plan:        'trial'
    });

    await db.collection('users').doc(uid).set({
        email,
        providerId: providerRef.id,
        role: 'provider',
        createdAt: Date.now()
    }, { merge: true });

    setCurrentProviderId(providerRef.id);
    return { uid, providerId: providerRef.id };
}

// ==========================================
// 🔑 تسجيل دخول صاحب الصالون
// ==========================================
async function logInProvider(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const userDoc = await db.collection('users').doc(cred.user.uid).get();
    if (!userDoc.exists || !userDoc.data().providerId) {
        throw { code: 'gohajz/no-provider', message: 'هذا الحساب مو مرتبط بأي صالون.' };
    }
    const providerId = userDoc.data().providerId;
    setCurrentProviderId(providerId);
    return { uid: cred.user.uid, providerId };
}

function logOutProvider() {
    clearCurrentProviderId();
    return auth.signOut();
}

// ==========================================
// 👤 حساب الزبون - رقم هاتف + رمز شخصي (بدون إيميل، ملائم للسياق العراقي)
// ==========================================
function getCurrentCustomerPhone() {
    return localStorage.getItem('gohajz_customer_phone') || null;
}
function setCurrentCustomerPhone(phone) {
    localStorage.setItem('gohajz_customer_phone', phone);
}
function clearCurrentCustomerPhone() {
    localStorage.removeItem('gohajz_customer_phone');
}
function getCurrentCustomerName() {
    return localStorage.getItem('gohajz_customer_name') || '';
}

// 📝 تسجيل زبون جديد - اسم، هاتف، جنس، مواليد، محافظة، رمز شخصي
async function signUpCustomer(name, phone, gender, birthdate, governorate, pin) {
    const cleanPhone = String(phone).replace(/[^0-9]/g,'');
    if (!cleanPhone || cleanPhone.length < 10)
        throw { message: 'رقم الهاتف غير صحيح' };
    if (!pin || pin.length < 4)
        throw { message: 'الرمز 4 أرقام على الأقل' };

    await ensureGuestSignedIn(); // تسجيل دخول مجهول - يكفي للوصول الآمن لقاعدة البيانات

    const existing = await db.collection('customers').doc(cleanPhone).get();
    if (existing.exists)
        throw { message: 'هذا الرقم مسجّل حساب أصلاً - سجّل دخولك' };

    await db.collection('customers').doc(cleanPhone).set({
        name, phone: cleanPhone, gender, birthdate, governorate, pin,
        createdAt: Date.now()
    });

    setCurrentCustomerPhone(cleanPhone);
    localStorage.setItem('gohajz_customer_name', name);
    return { phone: cleanPhone };
}

async function logInCustomer(phone, pin) {
    const cleanPhone = String(phone).replace(/[^0-9]/g,'');
    await ensureGuestSignedIn();

    const doc = await db.collection('customers').doc(cleanPhone).get();
    if (!doc.exists) throw { message: 'ماكو حساب بهذا الرقم' };
    if (String(doc.data().pin) !== String(pin)) throw { message: 'الرمز غلط' };

    setCurrentCustomerPhone(cleanPhone);
    localStorage.setItem('gohajz_customer_name', doc.data().name || '');
    return { phone: cleanPhone, name: doc.data().name };
}

function logOutCustomer() {
    clearCurrentCustomerPhone();
    localStorage.removeItem('gohajz_customer_name');
}

function isCustomerLoggedIn() {
    return !!getCurrentCustomerPhone();
}

async function getCurrentCustomerInfo() {
    const phone = getCurrentCustomerPhone();
    if (!phone) return null;
    const doc = await db.collection('customers').doc(phone).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// جلب كل حجوزات الزبون الحالي، عبر كل الصالونات دفعة وحدة (Collection Group Query)
async function getMyBookings() {
    const phone = getCurrentCustomerPhone();
    if (!phone) return [];

    const snap = await db.collectionGroup('bookings')
        .where('customerPhone', '==', phone)
        .get();

    const bookings = [];
    for (const doc of snap.docs) {
        const providerId = doc.ref.parent.parent.id;
        bookings.push({ id: doc.id, providerId, ...doc.data() });
    }
    // ترتيب الأحدث أولاً
    bookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // إضافة اسم الصالون لكل حجز (للعرض)
    const providerCache = {};
    for (const b of bookings) {
        if (!providerCache[b.providerId]) {
            providerCache[b.providerId] = await getProviderInfo(b.providerId);
        }
        b.providerName = providerCache[b.providerId]?.name || 'صالون محذوف';
    }
    return bookings;
}

// ==========================================
// 👤 تسجيل دخول مجهول شفاف (للوصول الآمن لقاعدة البيانات فقط - ما يمثّل
// هوية الزبون، هوية الزبون الحقيقية هي رقم هاتفه المخزّن بـ localStorage)
// ==========================================
function ensureGuestSignedIn() {
    return new Promise((resolve, reject) => {
        if (auth.currentUser) { resolve(auth.currentUser); return; }
        auth.signInAnonymously().then(cred => resolve(cred.user)).catch(reject);
    });
}

// ==========================================
// 📂 دوال بيانات الصالون
// ==========================================
function providerServicesCollection(providerId) {
    return db.collection('providers').doc(providerId).collection('services');
}
function providerBookingsCollection(providerId) {
    return db.collection('providers').doc(providerId).collection('bookings');
}

async function getProviderInfo(providerId) {
    const doc = await db.collection('providers').doc(providerId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function getAllActiveProviders(categoryFilter) {
    let query = db.collection('providers').where('isActive', '==', true);
    const snap = await query.get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (categoryFilter) list = list.filter(p => p.category === categoryFilter);
    return list;
}

// 🆕 أيقونة مناسبة لكل قطاع - عام لكل الفئات، مو صالونات بس، عشان الأساس
// يوسّع بسهولة لأي نوع نشاط يحتاج حجز (مطابق لخريطة القطاعات بالمستند)
function getCategoryIcon(category) {
    const icons = {
        'رجالي': '💈', 'نسائي': '💇‍♀️',
        'طبيب': '🩺', 'عيادة_تجميل': '💉', 'مختبر': '🧪', 'سونار': '📷',
        'سبا': '🧖', 'نادي_رياضي': '🏋️',
        'تعليم_سياقة': '🚗', 'حضانة': '🧸',
        'غسيل_سيارات': '🚙', 'فني': '🛠️', 'أخرى': '📌'
    };
    return icons[category] || '📌';
}

// إنشاء حجز جديد (الزبون - لازم يكون مسجّل حساب برقم هاتفه)
async function createBooking(providerId, bookingData) {
    await ensureGuestSignedIn();
    const customerPhone = getCurrentCustomerPhone();
    const ref = providerBookingsCollection(providerId).doc();
    await ref.set({
        ...bookingData,
        customerPhone: customerPhone || null, // 🆕 ضروري حتى يقدر الزبون يشوف حجوزاته لاحقاً
        status: 'pending',
        createdAt: Date.now()
    });
    return ref.id;
}
