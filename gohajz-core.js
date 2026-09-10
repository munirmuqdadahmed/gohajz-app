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
// 👤 تسجيل دخول مجهول شفاف للزبائن (يسمح لهم يحجزون بأمان بدون حساب)
// ==========================================
function ensureGuestSignedIn() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged(user => {
            if (user) { resolve(user); return; }
            auth.signInAnonymously().then(cred => resolve(cred.user)).catch(reject);
        });
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

// إنشاء حجز جديد (الزبون - لازم يكون مسجّل دخول مجهول على الأقل)
async function createBooking(providerId, bookingData) {
    await ensureGuestSignedIn();
    const ref = providerBookingsCollection(providerId).doc();
    await ref.set({
        ...bookingData,
        status: 'pending',
        createdAt: Date.now()
    });
    return ref.id;
}
