
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://stktxuljvfppkmbrakyv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jXXg8F5SGhILTtL_TgtaKQ_TeOJ1EcF";
const TABLE = "study_data";
const STATE_KEYS = ["lessons", "resources", "parts", "reviews", "daily", "dailyPlans"];
const META_PREFIX = "study_tracker_cloud_sync_v2:";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

let currentUser = null;
let syncTimer = null;
let syncing = false;
let initialSyncUser = null;

const panel = document.createElement("section");
panel.id = "study-cloud-panel";

panel.innerHTML = `
    <style>
        #study-cloud-panel,
        #study-cloud-panel * {
            box-sizing: border-box;
        }

        #study-cloud-panel [hidden] {
            display: none !important;
        }

        #study-cloud-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 9px 14px;
            border: 1px solid rgba(212,180,90,.35);
            border-radius: 12px;
            background: #171717;
            color: #e8d39a;
            font: inherit;
            font-size: 13px;
            cursor: pointer;
            transition: .2s ease;
        }

        #study-cloud-trigger:hover {
            background: #252019;
            border-color: #c9aa61;
        }

        #study-cloud-trigger .cloud-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #999;
        }

        #study-cloud-trigger.is-online .cloud-dot {
            background: #24d18a;
            box-shadow: 0 0 9px rgba(36,209,138,.5);
        }

        #study-cloud-panel .cloud-menu {
            position: fixed;
            top: 76px;
            right: 16px;
            z-index: 99999;
            width: min(340px, calc(100vw - 32px));
            padding: 16px;
            border: 1px solid rgba(212,180,90,.28);
            border-radius: 16px;
            background: #151515;
            color: #f5f5f5;
            box-shadow: 0 18px 55px rgba(0,0,0,.42);
            direction: rtl;
            font-family: inherit;
        }

        #study-cloud-panel .cloud-menu-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 14px;
        }

        #study-cloud-panel .cloud-menu-title {
            font-size: 14px;
            font-weight: 700;
        }

        #study-cloud-panel .cloud-close {
            width: 30px;
            height: 30px;
            padding: 0;
            border: 0;
            border-radius: 9px;
            background: #292929;
            color: #ddd;
            font-size: 19px;
            cursor: pointer;
        }

        #study-cloud-panel .cloud-account {
            padding: 12px;
            margin-bottom: 12px;
            border: 1px solid #303030;
            border-radius: 12px;
            background: #1d1d1d;
        }

        #study-cloud-panel .cloud-account-label {
            margin-bottom: 5px;
            color: #aaa;
            font-size: 11px;
        }

        #study-cloud-panel .cloud-account-email {
            overflow-wrap: anywhere;
            color: #e9d7a7;
            font-size: 13px;
            direction: ltr;
            text-align: right;
        }

        #study-cloud-panel .cloud-fields {
            display: grid;
            gap: 9px;
            margin-bottom: 10px;
        }

        #study-cloud-panel input {
            width: 100%;
            min-width: 0;
            padding: 11px;
            border: 1px solid #414141;
            border-radius: 9px;
            outline: none;
            background: #090909;
            color: #fff;
            font: inherit;
            font-size: 13px;
        }

        #study-cloud-panel input:focus {
            border-color: #c5a65e;
        }

        #study-cloud-panel .cloud-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        #study-cloud-panel button.cloud-action {
            padding: 10px;
            border: 1px solid #b99b50;
            border-radius: 9px;
            background: #b99b50;
            color: #111;
            font: inherit;
            font-size: 12px;
            cursor: pointer;
        }

        #study-cloud-panel button.cloud-action.secondary {
            border-color: #444;
            background: #222;
            color: #e7d39a;
        }

        #study-cloud-panel button.cloud-action.danger {
            border-color: rgba(235,85,85,.35);
            background: rgba(180,45,45,.1);
            color: #ff7777;
        }

        #study-cloud-panel button:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        #study-cloud-panel .cloud-status {
            display: block;
            margin-top: 12px;
            padding: 10px;
            border-radius: 9px;
            background: #202020;
            color: #d9c58c;
            font-size: 11px;
            line-height: 1.9;
        }

        #study-cloud-panel .cloud-status:empty {
            display: none;
        }

        @media(max-width:600px) {
            #study-cloud-panel .cloud-menu {
                top: 65px;
                right: 10px;
                width: calc(100vw - 20px);
            }
        }
    </style>

    <button type="button" id="study-cloud-trigger">
        <span class="cloud-dot"></span>
        <span id="cloud-trigger-label">حساب کاربری</span>
        <span>⌄</span>
    </button>

    <div class="cloud-menu" id="cloud-menu" hidden>
        <div class="cloud-menu-header">
            <span class="cloud-menu-title">مدیریت حساب</span>
            <button type="button" class="cloud-close" id="cloud-close" aria-label="بستن">×</button>
        </div>

        <div class="cloud-account" id="cloud-account" hidden>
            <div class="cloud-account-label">حساب متصل</div>
            <div class="cloud-account-email" id="cloud-account-email"></div>
        </div>

        <div id="cloud-login-area">
            <div class="cloud-fields">
                <input id="cloud-email" type="email" autocomplete="email" placeholder="آدرس ایمیل">
                <input id="cloud-password" type="password" autocomplete="current-password" placeholder="رمز عبور">
            </div>

            <div class="cloud-actions">
                <button type="button" class="cloud-action" id="cloud-login">ورود</button>
                <button type="button" class="cloud-action secondary" id="cloud-signup">ایجاد حساب</button>
            </div>
        </div>

        <div id="cloud-user-actions" hidden>
            <div class="cloud-actions">
                <button type="button" class="cloud-action" id="cloud-sync">همگام‌سازی الآن</button>
                <button type="button" class="cloud-action danger" id="cloud-logout">خروج از حساب</button>
            </div>
        </div>

        <span class="cloud-status" id="cloud-status" role="status" aria-live="polite">
            برای استفاده از فضای ابری وارد حساب خود شو.
        </span>
    </div>
`;

const topbar = document.querySelector(".topbar");

panel.style.position = "relative";
panel.style.margin = "0";
panel.style.padding = "0";
panel.style.width = "auto";
panel.style.maxWidth = "none";
panel.style.border = "0";
panel.style.background = "transparent";

if (topbar) {
    topbar.style.display = "flex";
    topbar.style.alignItems = "center";
    topbar.style.justifyContent = "space-between";
    topbar.appendChild(panel);
} else {
    document.body.appendChild(panel);
}

const $ = id => document.getElementById(id);

const status = message => {
    $("cloud-status").textContent = message;
};

const localState = () => window.StudyTracker?.getState?.() || null;

const emptyState = () =>
    Object.fromEntries(STATE_KEYS.map(key => [key, []]));

function normalizeState(data) {
    const normalized = {};

    for (const key of STATE_KEYS) {
        normalized[key] = Array.isArray(data?.[key]) ? data[key] : [];
    }

    return normalized;
}

function stableStringify(value) {
    if (value === undefined) return "__undefined__";
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }

    return `{${Object.keys(value)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(",")}}`;
}

const sameData = (a, b) => stableStringify(a) === stableStringify(b);

const isObject = value =>
    value !== null && typeof value === "object" && !Array.isArray(value);

function arrayItemKey(item, index) {
    if (item && typeof item === "object") {
        if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
        if (item.resourceId !== undefined && item.resourceId !== null) {
            return `resource:${item.resourceId}`;
        }
        if (item.partId !== undefined && item.partId !== null) {
            return `part:${item.partId}`;
        }
    }

    if (item === null || typeof item !== "object") {
        return `value:${stableStringify(item)}`;
    }

    return `index:${index}:${stableStringify(item)}`;
}

function mergeArray(base = [], local = [], cloud = []) {
    const baseMap = new Map(
        base.map((item, index) => [arrayItemKey(item, index), item])
    );

    const localMap = new Map(
        local.map((item, index) => [arrayItemKey(item, index), item])
    );

    const cloudMap = new Map(
        cloud.map((item, index) => [arrayItemKey(item, index), item])
    );

    const orderedKeys = [];

    for (let index = 0; index < local.length; index++) {
        const key = arrayItemKey(local[index], index);
        if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }

    for (let index = 0; index < cloud.length; index++) {
        const key = arrayItemKey(cloud[index], index);
        if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }

    for (let index = 0; index < base.length; index++) {
        const key = arrayItemKey(base[index], index);
        if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }

    const merged = [];

    for (const key of orderedKeys) {
        const value = mergeValue(
            baseMap.has(key) ? baseMap.get(key) : undefined,
            localMap.has(key) ? localMap.get(key) : undefined,
            cloudMap.has(key) ? cloudMap.get(key) : undefined
        );

        if (value !== undefined) merged.push(value);
    }

    return merged;
}

function mergeValue(base, local, cloud) {
    if (sameData(local, cloud)) return local;
    if (sameData(local, base)) return cloud;
    if (sameData(cloud, base)) return local;

    if (local === undefined) return cloud;
    if (cloud === undefined) return local;

    if (Array.isArray(local) && Array.isArray(cloud)) {
        return mergeArray(Array.isArray(base) ? base : [], local, cloud);
    }

    if (isObject(local) && isObject(cloud)) {
        const baseObject = isObject(base) ? base : {};

        const keys = new Set([
            ...Object.keys(baseObject),
            ...Object.keys(local),
            ...Object.keys(cloud)
        ]);

        const result = {};

        for (const key of keys) {
            const value = mergeValue(
                Object.prototype.hasOwnProperty.call(baseObject, key)
                    ? baseObject[key]
                    : undefined,
                Object.prototype.hasOwnProperty.call(local, key)
                    ? local[key]
                    : undefined,
                Object.prototype.hasOwnProperty.call(cloud, key)
                    ? cloud[key]
                    : undefined
            );

            if (value !== undefined) result[key] = value;
        }

        return result;
    }

    return local;
}

function mergeStates(base, local, cloud) {
    const b = normalizeState(base || emptyState());
    const l = normalizeState(local || emptyState());
    const c = normalizeState(cloud || emptyState());

    const result = {};

    for (const key of STATE_KEYS) {
        result[key] = mergeArray(b[key], l[key], c[key]);
    }

    return result;
}

function metaKey() {
    return META_PREFIX + (currentUser?.id || "anonymous");
}

function readSyncMeta() {
    if (!currentUser) return null;

    try {
        const value = JSON.parse(localStorage.getItem(metaKey()) || "null");
        return value && value.snapshot ? value : null;
    } catch {
        return null;
    }
}

function saveSyncMeta(snapshot, updatedAt) {
    if (!currentUser) return;

    try {
        localStorage.setItem(metaKey(), JSON.stringify({
            snapshot: normalizeState(snapshot),
            updatedAt: updatedAt || null
        }));
    } catch (error) {
        console.warn("Study Tracker: unable to save sync metadata", error);
    }
}

function setSignedIn(user) {
    currentUser = user || null;

    $("cloud-login-area").hidden = !!user;
    $("cloud-user-actions").hidden = !user;
    $("cloud-account").hidden = !user;

    $("cloud-trigger-label").textContent = user
        ? "حساب من"
        : "ورود به حساب";

    $("study-cloud-trigger").classList.toggle("is-online", !!user);

    $("cloud-account-email").textContent = user?.email || "";
}

function openMenu() {
    $("cloud-menu").hidden = false;
}

function closeMenu() {
    $("cloud-menu").hidden = true;
}

$("study-cloud-trigger").addEventListener("click", () => {
    $("cloud-menu").hidden
        ? openMenu()
        : closeMenu();
});

$("cloud-close").addEventListener("click", closeMenu);

document.addEventListener("click", event => {
    if (!panel.contains(event.target)) {
        closeMenu();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
});

async function readCloudRow() {
    const { data, error } = await supabase
        .from(TABLE)
        .select("data, updated_at")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function insertLocalToCloud(data) {
    const { data: row, error } = await supabase
        .from(TABLE)
        .insert({
            user_id: currentUser.id,
            data: normalizeState(data)
        })
        .select("updated_at")
        .single();

    if (error) throw error;

    saveSyncMeta(data, row.updated_at);
    return row;
}

async function uploadWithVersion(data, expectedUpdatedAt) {
    const { data: rows, error } = await supabase
        .from(TABLE)
        .update({ data: normalizeState(data) })
        .eq("user_id", currentUser.id)
        .eq("updated_at", expectedUpdatedAt)
        .select("updated_at");

    if (error) throw error;
    if (!rows?.length) return null;

    return rows[0];
}

function applyLocalState(data) {
    const normalized = normalizeState(data);

    if (!sameData(localState(), normalized)) {
        window.StudyTracker.replaceState(normalized);
    }
}

async function syncNow() {
    if (!currentUser || !navigator.onLine || syncing) {
        if (currentUser && !navigator.onLine) {
            status("آفلاین هستی؛ تغییرات روی دستگاه ذخیره می‌شوند و بعداً همگام خواهند شد.");
        }
        return;
    }

    syncing = true;

    try {
        status("در حال همگام‌سازی...");

        let local = normalizeState(localState());
        let row = await readCloudRow();
        let meta = readSyncMeta();

        if (!meta) {
            const hasLocalData = STATE_KEYS.some(
                key => local[key].length > 0
            );

            const legacyClaimedByCurrentUser =
                localStorage.getItem("study_tracker_v3:legacy_claimed") === currentUser.id;

            // اگر حساب در فضای ابری داده دارد
            if (row) {
                // داده قدیمی محلی و داده ابری را خودکار ادغام نکن
                if (hasLocalData && legacyClaimedByCurrentUser) {
                    status(
                        "این حساب هم اطلاعات قدیمی دستگاه و هم اطلاعات ابری دارد. هر دو محفوظ‌اند؛ برای جلوگیری از ادغام اشتباه، همگام‌سازی اولیه متوقف شد."
                    );
                    return;
                }

                // جلوگیری از انتقال اطلاعات حساب دیگر
                if (hasLocalData) {
                    status(
                        "اطلاعات محلی هنوز به این حساب اختصاص داده نشده است. برای جلوگیری از ترکیب اطلاعات، همگام‌سازی متوقف شد."
                    );
                    return;
                }

                applyLocalState(row.data);
                saveSyncMeta(row.data, row.updated_at);

                status("اطلاعات اختصاصی این حساب از فضای ابری دریافت شد.");
                return;
            }

            // اگر حساب ابری هنوز رکوردی ندارد
            if (hasLocalData && !legacyClaimedByCurrentUser) {
                status(
                    "اطلاعات محلی به این حساب اختصاص داده نشده است؛ برای جلوگیری از انتقال اشتباه، همگام‌سازی متوقف شد."
                );
                return;
            }

            await insertLocalToCloud(local);

            status(
                hasLocalData
                    ? "اطلاعات قدیمی حساب با موفقیت به فضای ابری منتقل شد."
                    : "فضای ابری این حساب آماده شد."
            );
            return;
        }

        // همگام‌سازی عادی حساب‌هایی که سابقه همگام‌سازی دارند
        if (!row) {
            await insertLocalToCloud(local);
            status("اطلاعات دستگاه در فضای ابری ذخیره شد.");
            return;
        }

        for (let attempt = 0; attempt < 4; attempt++) {
            const base = normalizeState(meta.snapshot || emptyState());

            local = normalizeState(localState());

            const merged = mergeStates(base, local, row.data);

            if (sameData(merged, row.data)) {
                applyLocalState(merged);
                saveSyncMeta(merged, row.updated_at);
                status("همگام‌سازی کامل است.");
                return;
            }

            const updated = await uploadWithVersion(merged, row.updated_at);

            if (updated) {
                applyLocalState(merged);
                saveSyncMeta(merged, updated.updated_at);
                status("تغییرات با موفقیت همگام شدند.");
                return;
            }

            row = await readCloudRow();

            if (!row) {
                throw new Error("رکورد اطلاعات ابری پیدا نشد.");
            }
        }

        status(
            "چند تغییر هم‌زمان شناسایی شد. اطلاعات محلی حفظ شده‌اند؛ کمی بعد دوباره تلاش کن."
        );

    } catch (error) {
        console.error("Study Tracker cloud sync:", error);
        status("خطا در همگام‌سازی: " + (error.message || "خطای ناشناخته"));
    } finally {
        syncing = false;
    }
}

$("cloud-signup").addEventListener("click", async () => {
    const email = $("cloud-email").value.trim();
    const password = $("cloud-password").value;

    if (!email || password.length < 6) {
        return status("ایمیل معتبر و رمز عبور حداقل ۶ کاراکتری وارد کن.");
    }

    status("در حال ایجاد حساب...");

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: window.location.origin
        }
    });

    if (error) {
        return status("خطا در ثبت‌نام: " + error.message);
    }

    status("ثبت‌نام انجام شد. در صورت نیاز، ایمیلت را برای تأیید باز کن.");
});

$("cloud-login").addEventListener("click", async () => {
    const email = $("cloud-email").value.trim();
    const password = $("cloud-password").value;

    if (!email || !password) {
        return status("ایمیل و رمز عبور را وارد کن.");
    }

    status("در حال ورود...");

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return status("خطا در ورود: " + error.message);
    }
});

$("cloud-logout").addEventListener("click", async () => {
    status("در حال خروج از حساب...");

    const { error } = await supabase.auth.signOut();

    if (error) {
        status("خطا در خروج: " + error.message);
        return;
    }

    status("از حساب خارج شدی. اطلاعات محلی دستگاه حذف نشده‌اند.");
});

$("cloud-sync").addEventListener("click", syncNow);

window.addEventListener("studytracker:local-save", () => {
    if (!currentUser) return;

    clearTimeout(syncTimer);

    status(
        navigator.onLine
            ? "تغییرات ذخیره شدند؛ همگام‌سازی در صف است..."
            : "آفلاین هستی؛ تغییرات برای همگام‌سازی بعدی نگه داشته شدند."
    );

    if (navigator.onLine) {
        syncTimer = setTimeout(syncNow, 1200);
    }
});

window.addEventListener("online", () => {
    if (currentUser) syncNow();
});

supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user || null;
    const changedUser = user?.id !== currentUser?.id;

    // تغییر فضای ذخیره‌سازی قبل از شروع همگام‌سازی
    if (changedUser) {
        window.StudyTracker?.switchAccount?.(user?.id || null);
    }

    setSignedIn(user);

    if (
        user &&
        (changedUser || event === "INITIAL_SESSION" || event === "SIGNED_IN")
    ) {
        if (initialSyncUser !== user.id) {
            initialSyncUser = user.id;
            setTimeout(syncNow, 0);
        }
    } else if (!user) {
        initialSyncUser = null;

        if (event === "SIGNED_OUT") {
            status("از حساب خارج شدی. اطلاعات محلی این دستگاه حفظ شده‌اند.");
        }
    }
});
