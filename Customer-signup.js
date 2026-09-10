<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoHajz - إنشاء حساب</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    <style>
        :root { --gold: #C69C32; --green-deep: #123524; --green-darker: #0a1f16; }
        * { box-sizing: border-box; }
        body {
            font-family: 'Tajawal', sans-serif; direction: rtl;
            background: var(--green-darker); color: #fff; margin: 0;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 20px;
        }
        .card {
            background: #142a1f; border: 1px solid #24392c; border-radius: 16px;
            padding: 30px 24px; max-width: 380px; width: 100%;
        }
        h1 { text-align: center; color: var(--gold); font-size: 1.3rem; margin-bottom: 6px; }
        p.sub { text-align: center; color: #888; font-size: 0.85rem; margin-bottom: 20px; }
        label { display: block; font-size: 0.8rem; color: #ccc; margin-bottom: 5px; margin-top: 12px; }
        input {
            width: 100%; padding: 11px; background: #0a1f16; border: 1px solid #24392c;
            border-radius: 8px; color: #fff; font-size: 0.95rem; font-family: inherit;
        }
        button {
            width: 100%; margin-top: 22px; padding: 13px; background: var(--gold);
            color: #000; border: none; border-radius: 8px; font-weight: 900;
            font-size: 1rem; cursor: pointer; font-family: inherit;
        }
        button:disabled { opacity: 0.6; }
        .error { color: #ef4444; font-size: 0.82rem; margin-top: 10px; text-align: center; }
        .link { text-align: center; margin-top: 16px; font-size: 0.85rem; }
        .link a { color: #E5C158; text-decoration: none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>📅 إنشاء حساب GoHajz</h1>
        <p class="sub">سوّي حساب مرة وحدة، وتقدر تتابع كل حجوزاتك بأي وقت</p>

        <label>اسمك:</label>
        <input type="text" id="custName" placeholder="اسمك الكامل">

        <label>رقم هاتفك:</label>
        <input type="tel" id="custPhone" placeholder="07xxxxxxxxx" style="direction:ltr;text-align:left;">

        <label>بريدك الإلكتروني:</label>
        <input type="email" id="email" placeholder="you@example.com">

        <label>كلمة المرور:</label>
        <input type="password" id="password" placeholder="6 أحرف على الأقل">

        <button id="submitBtn" onclick="handleSignup()">إنشاء الحساب</button>
        <div id="errorMsg" class="error"></div>

        <div class="link">عندك حساب أصلًا؟ <a href="customer-login.html">سجّل دخولك</a></div>
        <div class="link"><a href="index.html">🔙 رجوع للتصفح</a></div>
    </div>

    <script src="gohajz-core.js"></script>
    <script>
        async function handleSignup() {
            const name  = document.getElementById('custName').value.trim();
            const phone = document.getElementById('custPhone').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const errEl = document.getElementById('errorMsg');
            const btn = document.getElementById('submitBtn');
            errEl.innerText = '';

            if (!name) return errEl.innerText = '⚠️ اكتب اسمك.';
            if (!email) return errEl.innerText = '⚠️ أدخل بريدك الإلكتروني.';
            if (password.length < 6) return errEl.innerText = '⚠️ كلمة المرور 6 أحرف على الأقل.';

            btn.disabled = true;
            btn.innerText = 'جاري الإنشاء...';

            try {
                await signUpCustomer(email, password, name, phone);
                window.location.href = 'index.html';
            } catch (err) {
                btn.disabled = false;
                btn.innerText = 'إنشاء الحساب';
                const map = {
                    'auth/email-already-in-use': '⚠️ هذا البريد مستخدم أصلًا.',
                    'auth/invalid-email': '⚠️ صيغة البريد غير صحيحة.',
                    'auth/weak-password': '⚠️ كلمة المرور ضعيفة.',
                };
                errEl.innerText = map[err.code] || ('⚠️ صار خطأ: ' + err.message);
            }
        }
    </script>
</body>
</html>
