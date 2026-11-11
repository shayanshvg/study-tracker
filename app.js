const KEY = "study_tracker_v3";
const ANONYMOUS_KEY = `${KEY}:anonymous`;
const LEGACY_CLAIM_KEY = `${KEY}:legacy_claimed`;

let activeStorageKey = localStorage.getItem(LEGACY_CLAIM_KEY)
    ? ANONYMOUS_KEY
    : KEY;

const $ = id => document.getElementById(id);

const defaultState = {

    lessons: [],

    resources: [],

    parts: [],

    reviews: [],

    daily: [],

    dailyPlans: []

};

let state = loadState();

let reviewFilter = "due";

let editing = null;

function uid() {

    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

}

function loadState(storageKey = activeStorageKey) {
    try {
        const old = JSON.parse(localStorage.getItem(storageKey));

        if (!old) return structuredClone(defaultState);

        return {
            lessons: Array.isArray(old.lessons) ? old.lessons : [],
            resources: Array.isArray(old.resources) ? old.resources : [],
            parts: Array.isArray(old.parts) ? old.parts : [],
            reviews: Array.isArray(old.reviews) ? old.reviews : [],
            daily: Array.isArray(old.daily) ? old.daily : [],
            dailyPlans: Array.isArray(old.dailyPlans) ? old.dailyPlans : []
        };
    } catch {
        return structuredClone(defaultState);
    }
}

function save() {

    localStorage.setItem(activeStorageKey, JSON.stringify(state));

    render();

    window.dispatchEvent(new CustomEvent("studytracker:local-save", {
        detail: { state: structuredClone(state) }
    }));

}

function faDigits(value) {

    return String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

}

function enDigits(value) {

    return String(value)

        .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))

        .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

}

/* Jalali Date */

function div(a, b) {

    return Math.floor(a / b);

}

function jalaliToGregorian(jy, jm, jd) {

    jy += 1595;

    let days = -355668 + 365 * jy +

        div(jy, 33) * 8 +

        div((jy % 33) + 3, 4) + jd;

    if (jm < 7) days += (jm - 1) * 31;

    else days += (jm - 7) * 30 + 186;

    let gy = 400 * div(days, 146097);

    days %= 146097;

    if (days > 36524) {

        gy += 100 * div(--days, 36524);

        days %= 36524;

        if (days >= 365) days++;

    }

    gy += 4 * div(days, 1461);

    days %= 1461;

    if (days > 365) {

        gy += div(days - 1, 365);

        days = (days - 1) % 365;

    }

    let gd = days + 1;

    const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;

    const monthDays = [

        0, 31, leap ? 29 : 28, 31, 30, 31,

        30, 31, 31, 30, 31, 30, 31

    ];

    let gm = 1;

    while (gm <= 12 && gd > monthDays[gm]) {

        gd -= monthDays[gm];

        gm++;

    }

    return [gy, gm, gd];

}

function gregorianToJalali(gy, gm, gd) {

    const gdm = [

        0, 31, 59, 90, 120, 151,

        181, 212, 243, 273, 304, 334

    ];

    let gy2 = gm > 2 ? gy + 1 : gy;

    let days = 355666 + 365 * gy +

        div(gy2 + 3, 4) -

        div(gy2 + 99, 100) +

        div(gy2 + 399, 400) +

        gd + gdm[gm - 1];

    let jy = -1595 + 33 * div(days, 12053);

    days %= 12053;

    jy += 4 * div(days, 1461);

    days %= 1461;

    if (days > 365) {

        jy += div(days - 1, 365);

        days = (days - 1) % 365;

    }

    let jm, jd;

    if (days < 186) {

        jm = 1 + div(days, 31);

        jd = 1 + days % 31;

    } else {

        jm = 7 + div(days - 186, 30);

        jd = 1 + (days - 186) % 30;

    }

    return [jy, jm, jd];

}

function todayISO() {

    const now = new Date();

    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

    return local.toISOString().slice(0, 10);

}

function isoToJalali(iso) {

    if (!iso) return "";

    const [gy, gm, gd] = iso.split("-").map(Number);

    const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);

    return `${faDigits(String(jd).padStart(2, "0"))}/${faDigits(String(jm).padStart(2, "0"))}/${faDigits(jy)}`;

}

function jalaliToISO(value) {

    const clean = enDigits(value.trim()).replace(/[-.]/g, "/");

    const parts = clean.split("/").map(Number);

    if (parts.length !== 3 || parts.some(n => !Number.isInteger(n))) {

        return null;

    }

    const [jd, jm, jy] = parts;

    if (jy < 1200 || jy > 1600 || jm < 1 || jm > 12 || jd < 1) {

        return null;

    }

    if (jm <= 6 && jd > 31) return null;

    if (jm >= 7 && jm <= 11 && jd > 30) return null;

    if (jm === 12 && jd > 30) return null;

    const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);

    const date = new Date(gy, gm - 1, gd);

    if (

        date.getFullYear() !== gy ||

        date.getMonth() !== gm - 1 ||

        date.getDate() !== gd

    ) {

        return null;

    }

    return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;

}

function formatDate(iso) {

    return isoToJalali(iso) || "—";

}

function addDays(iso, count) {

    const [y, m, d] = iso.split("-").map(Number);

    const date = new Date(y, m - 1, d, 12);

    date.setDate(date.getDate() + count);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

}

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        '"': "&quot;",

        "'": "&#039;"

    })[char]);

}

/* Data Helpers */

function lessonOf(id) {

    return state.lessons.find(item => item.id === id);

}

function resourceOf(id) {

    return state.resources.find(item => item.id === id);

}

function partsOfLesson(lessonId) {

    return state.parts.filter(part => part.lessonId === lessonId);

}

function partResourceEntries(part) {
    if (Array.isArray(part.resources) && part.resources.length) return part.resources;
    return part.resourceId ? [{ resourceId: part.resourceId, pages: Number(part.pages || 0) }] : [];
}

function partsOfResource(resourceId) {
    return state.parts.filter(part => partResourceEntries(part).some(entry => entry.resourceId === resourceId));
}

function studiedPages(resourceId, exceptPartId = null) {
    return partsOfResource(resourceId)
        .filter(part => part.id !== exceptPartId)
        .reduce((sum, part) => sum + partResourceEntries(part)
            .filter(entry => entry.resourceId === resourceId)
            .reduce((total, entry) => total + Number(entry.pages || 0), 0), 0);
}

function lessonNextCode(lessonId, exceptPartId = null) {

    const lesson = lessonOf(lessonId);

    if (!lesson) return "";

    const max = partsOfLesson(lessonId)

        .filter(part => part.id !== exceptPartId)

        .reduce((highest, part) => {

            const match = String(part.code || "").match(/-(\d+)$/);

            return match ? Math.max(highest, Number(match[1])) : highest;

        }, 0);

    return `${lesson.code}-${String(max + 1).padStart(2, "0")}`;

}

function progress(resource) {

    const used = studiedPages(resource.id);

    return Math.min(100, Math.round(used / resource.totalPages * 100));

}

/* Reviews */

const REVIEW_INTERVALS = [0, 1, 3, 10, 30, 90, 180, 360];

function createReviews(part) {

    const baseDate = part.scheduleBaseDate || part.date;

    return REVIEW_INTERVALS.map((days, index) => ({

        id: uid(),

        partId: part.id,

        stage: index + 1,

        label: `R${index + 1}`,

        interval: days,

        dueDate: addDays(baseDate, days),

        completed: false,

        completedAt: null

    }));

}

function rebuildPartReviews(part, preserveCompleted = true) {

    const oldReviews = state.reviews.filter(review => review.partId === part.id);

    const oldCompleted = new Map(

        oldReviews

            .filter(review => review.completed)

            .map(review => [review.stage, review])

    );

    state.reviews = state.reviews.filter(review => review.partId !== part.id);

    const newReviews = createReviews(part).map(review => {

        const old = preserveCompleted ? oldCompleted.get(review.stage) : null;

        if (old) {

            return {

                ...review,

                id: old.id,

                completed: true,

                completedAt: old.completedAt

            };

        }

        return review;

    });

    state.reviews.push(...newReviews);

}

function reviewHTML(review) {

    const part = state.parts.find(item => item.id === review.partId);

    const lesson = part ? lessonOf(part.lessonId) : null;

    const resourceNames = part ? partResourceEntries(part).map(entry => resourceOf(entry.resourceId)?.name || "نامشخص").join("، ") : "نامشخص";

    const overdue = !review.completed && review.dueDate < todayISO();

    return `

        <div class="review-card">

            <div>

                <strong>${escapeHTML(review.label)} — ${escapeHTML(part?.code || "پارت حذف‌شده")}</strong>

                <div class="meta">

                    <span>${escapeHTML(lesson?.name || "درس نامشخص")}</span>

                    <span>${escapeHTML(resourceNames || "منبع نامشخص")}</span>

                    <span>سررسید: ${formatDate(review.dueDate)}</span>

                </div>

            </div>

            <div class="card-actions">

                ${

                    review.completed

                        ? `<span class="badge done">انجام‌شده</span>`

                        : overdue

                            ? `<span class="badge overdue">معوق</span>`

                            : `<span class="badge">در انتظار</span>`

                }

                <button class="secondary-btn" onclick="toggleReview('${review.id}')">

                    ${review.completed ? "بازگردانی" : "ثبت مرور"}

                </button>

            </div>

        </div>

    `;

}

function toggleReview(id) {

    const review = state.reviews.find(item => item.id === id);

    if (!review) return;

    review.completed = !review.completed;

    review.completedAt = review.completed ? todayISO() : null;

    save();

}

function renderReviews() {

    const today = todayISO();

    let reviews = [...state.reviews];

    if (reviewFilter === "due") {

        reviews = reviews.filter(r => !r.completed && r.dueDate <= today);

    } else if (reviewFilter === "upcoming") {

        reviews = reviews.filter(r => !r.completed && r.dueDate > today);

    } else if (reviewFilter === "done") {

        reviews = reviews.filter(r => r.completed);

    }

    reviews.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    $("reviewList").innerHTML = reviews.length

        ? reviews.map(reviewHTML).join("")

        : `<div class="empty">مروری در این دسته وجود ندارد.</div>`;

}

/* Main Rendering */

function render() {

    $("today").textContent = `امروز: ${formatDate(todayISO())}`;

    renderLessonOptions();

    renderResourceOptions();

    renderDashboard();

    renderLessons();

    renderResources();

    renderPartFilter();

    renderParts();

    renderReviews();

    renderDaily();

    renderPlanLessonOptions();

    renderDailyPlan();

    updateStudyPreview();

}

function renderLessonOptions() {

    const options = state.lessons.map(lesson =>

        `<option value="${lesson.id}">${escapeHTML(lesson.name)} (${escapeHTML(lesson.code)})</option>`

    ).join("");

    const resourceSelected = $("resourceLesson").value;

    const studySelected = $("studyLesson").value;

    $("resourceLesson").innerHTML =

        `<option value="">انتخاب درس...</option>` + options;

    $("studyLesson").innerHTML =

        `<option value="">انتخاب درس...</option>` + options;

    if (state.lessons.some(l => l.id === resourceSelected)) {

        $("resourceLesson").value = resourceSelected;

    }

    if (state.lessons.some(l => l.id === studySelected)) {

        $("studyLesson").value = studySelected;

    }

}

function renderResourceOptions() {
    const lessonId = $("studyLesson").value;
    renderStudyResourceRows(lessonId);
}

function resourceRowsHTML(lessonId, entries = []) {
    const resources = state.resources.filter(resource => resource.lessonId === lessonId);
    if (!resources.length) return '<p class="muted">برای این درس هنوز منبعی ثبت نشده است.</p>';
    const rows = entries.length ? entries : [{ resourceId: resources[0].id, pages: "" }];
    return rows.map(entry => {
        const resource = resources.find(item => item.id === entry.resourceId) || resources[0];
        const remaining = resource.totalPages - studiedPages(resource.id);
        return `<div class="study-resource-row">
            <select class="study-resource-select" required>
                ${resources.map(item => `<option value="${item.id}" ${item.id === resource.id ? "selected" : ""}>${escapeHTML(item.name)} — ${faDigits(Math.max(0, item.totalPages - studiedPages(item.id)))} صفحه باقی‌مانده</option>`).join("")}
            </select>
            <input class="study-resource-pages" type="number" min="1" max="${remaining}" value="${entry.pages ?? ""}" placeholder="تعداد صفحات" required>
            <button type="button" class="danger-btn remove-resource-btn">حذف</button>
        </div>`;
    }).join("");
}

function readResourceRows(containerId) {
    return [...$(containerId).querySelectorAll(".study-resource-row")].map(row => ({
        resourceId: row.querySelector(".study-resource-select").value,
        pages: Number(row.querySelector(".study-resource-pages").value)
    }));
}

function updateRemoveResourceButtons(container) {
    const rows = container.querySelectorAll(".study-resource-row");
    rows.forEach(row => { row.querySelector(".remove-resource-btn").disabled = rows.length <= 1; });
}

function bindResourceRowButtons(container) {
    container.querySelectorAll(".remove-resource-btn").forEach(button => {
        button.onclick = () => { button.closest(".study-resource-row").remove(); updateRemoveResourceButtons(container); };
    });
    updateRemoveResourceButtons(container);
}

function renderStudyResourceRows(lessonId, entries = []) {
    const container = $("studyResources");
    if (!container) return;
    container.innerHTML = resourceRowsHTML(lessonId, entries);
    bindResourceRowButtons(container);
}

function addResourceRow(containerId, lessonId) {
    const container = $(containerId);
    const existing = readResourceRows(containerId);
    const available = state.resources.filter(resource => resource.lessonId === lessonId && !existing.some(entry => entry.resourceId === resource.id));
    if (!available.length) { alert("منبع دیگری برای افزودن وجود ندارد."); return; }
    const resource = available[0];
    const row = document.createElement("div");
    row.innerHTML = resourceRowsHTML(lessonId, [...existing, { resourceId: resource.id, pages: "" }]);
    container.innerHTML = row.innerHTML;
    bindResourceRowButtons(container);
}

function validateResourceEntries(lessonId, entries, exceptPartId = null) {
    if (!entries.length || entries.some(entry => !entry.resourceId || !Number.isInteger(entry.pages) || entry.pages < 1)) {
        alert("حداقل یک منبع با تعداد صفحات صحیح و مثبت وارد کن."); return false;
    }
    if (new Set(entries.map(entry => entry.resourceId)).size !== entries.length) {
        alert("هر منبع را فقط یک‌بار در یک پارت انتخاب کن."); return false;
    }
    for (const entry of entries) {
        const resource = resourceOf(entry.resourceId);
        if (!resource || resource.lessonId !== lessonId) { alert("یکی از منابع با درس انتخاب‌شده مطابقت ندارد."); return false; }
        const remaining = resource.totalPages - studiedPages(entry.resourceId, exceptPartId);
        if (entry.pages > remaining) { alert(`از منبع «${resource.name}» فقط ${faDigits(remaining)} صفحه باقی مانده است.`); return false; }
    }
    return true;
}

function renderDashboard() {

    const totalPages = state.resources.reduce(

        (sum, r) => sum + Number(r.totalPages), 0

    );

    const readPages = state.resources.reduce(

        (sum, r) => sum + studiedPages(r.id), 0

    );

    const due = state.reviews.filter(

        r => !r.completed && r.dueDate <= todayISO()

    );

    const hours = state.daily.reduce(

        (sum, d) => sum + Number(d.hours || 0), 0

    );

    $("dashboardStats").innerHTML = `

        <div class="stat-card">

            <span>درس‌ها</span>

            <strong>${faDigits(state.lessons.length)}</strong>

        </div>

        <div class="stat-card">

            <span>صفحات مطالعه‌شده</span>

            <strong>${faDigits(readPages)}</strong>

        </div>

        <div class="stat-card">

            <span>مرورهای امروز و معوق</span>

            <strong>${faDigits(due.length)}</strong>

        </div>

        <div class="stat-card">

            <span>ساعت مطالعه ثبت‌شده</span>

            <strong>${faDigits(hours)}</strong>

        </div>

    `;

    $("dashboardReviews").innerHTML = due.length

        ? due.slice(0, 6).map(reviewHTML).join("")

        : `<div class="empty">مرور سررسیدشده‌ای نداری.</div>`;

    $("dashboardLessons").innerHTML = state.lessons.length

        ? state.lessons.map(lesson => {

            const lessonParts = partsOfLesson(lesson.id);

            const lessonResources = state.resources.filter(

                r => r.lessonId === lesson.id

            );

            const pages = lessonResources.reduce(

                (sum, r) => sum + studiedPages(r.id), 0

            );

            return `

                <div class="lesson-card">

                    <strong>${escapeHTML(lesson.name)} (${escapeHTML(lesson.code)})</strong>

                    <div class="meta">

                        <span>${faDigits(lessonParts.length)} پارت</span>

                        <span>${faDigits(pages)} صفحه مطالعه‌شده</span>

                        <span>${faDigits(lessonResources.length)} منبع</span>

                    </div>

                </div>

            `;

        }).join("")

        : `<div class="empty">ابتدا یک درس اضافه کن.</div>`;

}

/* Lessons */

function renderLessons() {
    $("lessonList").innerHTML = state.lessons.length
        ? state.lessons.map(lesson => {
            const lessonResources = state.resources.filter(
                r => r.lessonId === lesson.id
            );

            const count = partsOfLesson(lesson.id).length;

            return `
                <div class="lesson-card">
                    <h3>${escapeHTML(lesson.name)}</h3>
                    <div class="meta">
                        <span>شناسه: ${escapeHTML(lesson.code)}</span>
                        <span>${faDigits(lessonResources.length)} منبع</span>
                        <span>${faDigits(count)} پارت ثبت‌شده</span>
                    </div>
                    <div class="card-actions">
                        <button class="secondary-btn" onclick="editLesson('${lesson.id}')">
                            ویرایش درس
                        </button>
                        <button class="danger-btn" onclick="deleteLesson('${lesson.id}')">
                            حذف درس
                        </button>
                    </div>
                </div>
            `;
        }).join("")
        : `<div class="empty">هنوز درسی ثبت نشده است.</div>`;
}

function renderResources() {

    $("resourceList").innerHTML = state.resources.length

        ? state.resources.map(resource => {

            const lesson = lessonOf(resource.lessonId);

            const used = studiedPages(resource.id);

            const remaining = Math.max(0, resource.totalPages - used);

            const percent = progress(resource);

            return `

                <div class="resource-card">

                    <h3>${escapeHTML(resource.name)}</h3>

                    <div class="meta">

                        <span>درس: ${escapeHTML(lesson?.name || "نامشخص")}</span>

                        <span>شناسه: ${escapeHTML(lesson?.code || "—")}</span>

                    </div>

                    <div class="progress">

                        <div class="progress-fill" style="width:${percent}%"></div>

                    </div>

                    <div class="meta">

                        <span>کل: ${faDigits(resource.totalPages)}</span>

                        <span>خوانده‌شده: ${faDigits(used)}</span>

                        <span>باقی‌مانده: ${faDigits(remaining)}</span>

                        <span>${faDigits(percent)}٪</span>

                    </div>

                    <div class="card-actions">

                        <button class="secondary-btn" onclick="editResource('${resource.id}')">

                            ویرایش منبع

                        </button>

                    </div>

                </div>

            `;

        }).join("")

        : `<div class="empty">هنوز منبعی ثبت نشده است.</div>`;

}

/* Study Preview */

function updateStudyPreview() {

    const lessonId = $("studyLesson").value;

    const lesson = lessonOf(lessonId);

    $("studyPreview").textContent = lesson

        ? `پارت بعدی این درس: ${lessonNextCode(lessonId)}`

        : "ابتدا یک درس انتخاب کن.";

}

/* Parts */

function renderPartFilter() {

    const selected = $("partLessonFilter").value;

    $("partLessonFilter").innerHTML =

        `<option value="">همه درس‌ها</option>` +

        state.lessons.map(lesson =>

            `<option value="${lesson.id}">${escapeHTML(lesson.name)}</option>`

        ).join("");

    if (state.lessons.some(l => l.id === selected)) {

        $("partLessonFilter").value = selected;

    }

}

function renderParts() {

    const lessonId = $("partLessonFilter").value;

    const parts = state.parts

        .filter(part => !lessonId || part.lessonId === lessonId)

        .sort((a, b) => b.date.localeCompare(a.date));

    $("partList").innerHTML = parts.length

        ? parts.map(part => {

            const lesson = lessonOf(part.lessonId);

            const resourcesText = partResourceEntries(part).map(entry => `${resourceOf(entry.resourceId)?.name || "نامشخص"}: ${faDigits(entry.pages)} صفحه`).join("، ");
            const totalPages = partResourceEntries(part).reduce((sum, entry) => sum + Number(entry.pages || 0), 0);

            const reviewCount = state.reviews.filter(

                r => r.partId === part.id

            ).length;

            return `

                <div class="part-card">

                    <div>

                        <div class="part-code">${escapeHTML(part.code)}</div>

                        <strong>${escapeHTML(lesson?.name || "درس نامشخص")}</strong>

                        <div class="meta">

                            <span>منابع: ${escapeHTML(resourcesText || "نامشخص")}</span>

                            <span>مجموع: ${faDigits(totalPages)} صفحه</span>

                            <span>تاریخ مطالعه: ${formatDate(part.date)}</span>

                            <span>مبنای مرور: ${formatDate(part.scheduleBaseDate || part.date)}</span>

                            <span>${faDigits(reviewCount)} مرور</span>

                        </div>

                        ${part.notes ? `<p>${escapeHTML(part.notes)}</p>` : ""}

                        <div class="card-actions">

                            <button class="secondary-btn" onclick="editPart('${part.id}')">

                                ویرایش پارت

                            </button>

                            <button class="danger-btn" onclick="deletePart('${part.id}')">

                                حذف پارت

                            </button>

                        </div>

                    </div>

                </div>

            `;

        }).join("")

        : `<div class="empty">هنوز پارت ثبت نشده است.</div>`;

}

/* Edit and Delete Parts */

function editPart(id) {
    const part = state.parts.find(item => item.id === id);
    if (!part) return;
    const originalLessonId = part.lessonId;
    const lessonOptions = state.lessons.map(lesson => `<option value="${lesson.id}" ${lesson.id === part.lessonId ? "selected" : ""}>${escapeHTML(lesson.name)} (${escapeHTML(lesson.code)})</option>`).join("");
    openModal("ویرایش پارت مطالعه", `
        <label>درس</label><select id="modalPartLesson">${lessonOptions}</select>
        <label>منابع و تعداد صفحات</label><div id="modalPartResources" class="study-resources"></div>
        <button type="button" id="modalAddResource" class="secondary-btn">+ افزودن منبع دیگر</button>
        <label>تاریخ مطالعه (روز/ماه/سال)</label><input id="modalPartDate" class="jalali-date" value="${formatDate(part.date)}" required>
        <label>تاریخ مبنای مرور</label><input id="modalPartBaseDate" class="jalali-date" value="${formatDate(part.scheduleBaseDate || part.date)}" required>
        <label>توضیحات</label><textarea id="modalPartNotes">${escapeHTML(part.notes || "")}</textarea>
    `, () => {
        const lessonId = $("modalPartLesson").value;
        const entries = readResourceRows("modalPartResources");
        const date = jalaliToISO($("modalPartDate").value);
        const baseDate = jalaliToISO($("modalPartBaseDate").value);
        const notes = $("modalPartNotes").value.trim();
        if (!lessonOf(lessonId) || !validateResourceEntries(lessonId, entries, id)) return false;
        if (!date || !baseDate) { alert("تاریخ‌ها را به شکل روز/ماه/سال وارد کن."); return false; }
        const changedSchedule = date !== part.date || baseDate !== (part.scheduleBaseDate || part.date);
        part.lessonId = lessonId;
        part.resources = entries;
        delete part.resourceId; delete part.pages;
        part.date = date; part.scheduleBaseDate = baseDate; part.notes = notes;
        if (lessonId !== originalLessonId) part.code = lessonNextCode(lessonId, id);
        if (changedSchedule) rebuildPartReviews(part, true);
        return true;
    });
    const resourcesContainer = $("modalPartResources");
    renderResourceRowsForModal(part.lessonId, partResourceEntries(part));
    $("modalPartLesson").addEventListener("change", () => renderResourceRowsForModal($("modalPartLesson").value));
    $("modalAddResource").addEventListener("click", () => addResourceRow("modalPartResources", $("modalPartLesson").value));
    initializeJalaliInputs();
}

function renderResourceRowsForModal(lessonId, entries = []) {
    const container = $("modalPartResources");
    container.innerHTML = resourceRowsHTML(lessonId, entries);
    bindResourceRowButtons(container);
}

function deletePart(id) {

    const part = state.parts.find(item => item.id === id);

    if (!part) return;

    const count = state.reviews.filter(review => review.partId === id).length;

    if (!confirm(`پارت ${part.code} و ${faDigits(count)} مرور وابسته به آن حذف شوند؟ این عملیات قابل بازگشت نیست.`)) {

        return;

    }

    state.parts = state.parts.filter(item => item.id !== id);

    state.reviews = state.reviews.filter(review => review.partId !== id);

    save();

}

/* Daily Performance */

function renderDaily() {

    const items = [...state.daily].sort(

        (a, b) => b.date.localeCompare(a.date)

    );

    $("dailyList").innerHTML = items.length

        ? items.map(item => {

            const percentage = item.tests

                ? Math.round(item.correct / item.tests * 100)

                : 0;

            return `

                <div class="daily-card">

                    <div>

                        <strong>${formatDate(item.date)}</strong>

                        <div class="meta">

                            <span>${faDigits(item.hours)} ساعت</span>

                            <span>${faDigits(item.tests)} تست</span>

                            <span>${faDigits(item.correct)} صحیح</span>

                            <span>${faDigits(item.wrong)} غلط</span>

                            <span>${faDigits(item.blank)} نزده</span>

                            <span>${faDigits(percentage)}٪ صحیح از کل تست‌ها</span>

                        </div>

                        ${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ""}

                    </div>

                </div>

            `;

        }).join("")

        : `<div class="empty">هنوز عملکردی ثبت نشده است.</div>`;

}

/* Daily Study Plan */

function renderPlanLessonOptions() {

    const select = $("planLesson");

    const selected = select.value;

    select.innerHTML = `

        <option value="">انتخاب درس...</option>

        ${state.lessons.map(lesson => `

            <option value="${lesson.id}">

                ${escapeHTML(lesson.name)}

            </option>

        `).join("")}

    `;

    if (state.lessons.some(lesson => lesson.id === selected)) {

        select.value = selected;

    }

}

function getPlanItems(date) {

    const manualPlans = state.dailyPlans

        .filter(item => item.date === date)

        .map(item => ({

            id: item.id,

            type: "manual",

            title: lessonOf(item.lessonId)?.name || "درس حذف‌شده",

            completed: !!item.completed,

            original: item

        }));

    const automaticReviews = state.reviews

        .filter(review => review.dueDate === date)

        .map(review => {

            const part = state.parts.find(item => item.id === review.partId);

            const lesson = part ? lessonOf(part.lessonId) : null;

            return {

                id: review.id,

                type: "review",

                title: `${review.label} — ${part?.code || "پارت نامشخص"} — ${lesson?.name || "درس نامشخص"}`,

                completed: !!review.completed,

                original: review

            };

        });

    return [...manualPlans, ...automaticReviews];

}

function renderDailyPlan() {

    const date = jalaliToISO($("planDate").value) || todayISO();

    const plans = getPlanItems(date);

    const completed = plans.filter(item => item.completed).length;

    const total = plans.length;

    const percent = total ? Math.round(completed / total * 100) : 0;

    $("planCount").textContent =

        `${faDigits(completed)} از ${faDigits(total)} مورد`;

    $("planProgressText").textContent = `${faDigits(percent)}٪`;

    $("planProgressFill").style.width = `${percent}%`;

    $("emptyPlan").style.display = total ? "none" : "block";

    $("planTableBody").innerHTML = plans.map((item, index) => `

        <tr>

            <td>${faDigits(index + 1)}</td>

            <td><strong>${escapeHTML(item.title)}</strong></td>

            <td>

                <span class="badge ${item.type === "review" ? "review-type" : ""}">

                    ${item.type === "review" ? "مرور خودکار" : "برنامه دستی"}

                </span>

            </td>

            <td>

                ${item.completed

                    ? `<span class="plan-status completed">✓ انجام‌شده</span>`

                    : `<span class="plan-status pending">در انتظار</span>`

                }

            </td>

            <td>

                <button class="plan-done-btn"

                    onclick="${item.type === "review"

                        ? `toggleReview('${item.id}')`

                        : `togglePlanStatus('${item.id}')`}">

                    ${item.completed ? "بازگردانی" : "انجام شد"}

                </button>

                ${item.type === "manual" ? `

                    <button class="plan-delete-btn"

                        onclick="removeDailyPlan('${item.id}')">

                        حذف

                    </button>

                ` : ""}

            </td>

        </tr>

    `).join("");

}

function addDailyPlan(event) {

    event.preventDefault();

    const lessonId = $("planLesson").value;

    const lesson = lessonOf(lessonId);

    if (!lesson) {

        alert("ابتدا یک درس انتخاب کن.");

        return;

    }

    const date = jalaliToISO($("planDate").value) || todayISO();

    const duplicate = state.dailyPlans.some(item =>

        item.date === date && item.lessonId === lessonId

    );

    if (duplicate) {

        alert("این درس قبلاً به برنامه این روز اضافه شده است.");

        return;

    }

    state.dailyPlans.push({

        id: uid(),

        lessonId,

        date,

        completed: false,

        createdAt: Date.now()

    });

    $("planLesson").value = "";

    save();

}

function togglePlanStatus(id) {

    const plan = state.dailyPlans.find(item => item.id === id);

    if (!plan) return;

    plan.completed = !plan.completed;

    save();

}

function removeDailyPlan(id) {

    if (!confirm("این مورد از برنامه روزانه حذف شود؟")) return;

    state.dailyPlans = state.dailyPlans.filter(item => item.id !== id);

    save();

}

/* Modal */

function openModal(title, fields, onSave) {

    $("modalTitle").textContent = title;

    $("editFields").innerHTML = fields;

    editing = onSave;

    $("modal").classList.remove("hidden");

}

function closeModal() {

    $("modal").classList.add("hidden");

    editing = null;

}

function editLesson(id) {

    const lesson = lessonOf(id);

    if (!lesson) return;

    openModal("ویرایش درس", `

        <label>نام درس</label>

        <input id="modalName" value="${escapeHTML(lesson.name)}" required>

        <label>کلمه اختصاصی درس</label>

        <input id="modalCode" value="${escapeHTML(lesson.code)}" maxlength="12" required>

    `, () => {

        const name = $("modalName").value.trim();

        const code = $("modalCode").value.trim().toUpperCase();

        if (!name || !/^[A-Z0-9_-]+$/.test(code)) {

            alert("نام درس و شناسه معتبر وارد کن.");

            return false;

        }

        if (state.lessons.some(item =>

            item.id !== id && item.code.toUpperCase() === code

        )) {

            alert("این شناسه قبلاً برای درس دیگری استفاده شده است.");

            return false;

        }

        const oldCode = lesson.code;

        lesson.name = name;

        lesson.code = code;

        state.parts

            .filter(part => part.lessonId === id)

            .forEach(part => {

                const match = String(part.code).match(/-(\d+)$/);

                if (match) {

                    part.code = `${code}-${match[1]}`;

                } else {

                    part.code = code;

                }

            });

        return true;

    });

}

function deleteLesson(id) {
    const lesson = lessonOf(id);
    if (!lesson) return;

    const lessonParts = state.parts.filter(part => part.lessonId === id);
    const partIds = lessonParts.map(part => part.id);

    const resourceCount = state.resources.filter(
        resource => resource.lessonId === id
    ).length;

    const reviewCount = state.reviews.filter(
        review => partIds.includes(review.partId)
    ).length;

    const manualPlanCount = state.dailyPlans.filter(
        plan => plan.lessonId === id
    ).length;

    const message =
        `آیا از حذف درس «${lesson.name}» مطمئنی؟\n\n` +
        `منابع: ${faDigits(resourceCount)}\n` +
        `پارت‌ها: ${faDigits(lessonParts.length)}\n` +
        `مرورها: ${faDigits(reviewCount)}\n` +
        `برنامه‌های دستی: ${faDigits(manualPlanCount)}\n\n` +
        `تمام اطلاعات وابسته به این درس نیز حذف خواهند شد.`;

    if (!confirm(message)) return;

    state.reviews = state.reviews.filter(
        review => !partIds.includes(review.partId)
    );

    state.parts = state.parts.filter(
        part => part.lessonId !== id
    );

    state.resources = state.resources.filter(
        resource => resource.lessonId !== id
    );

    state.dailyPlans = state.dailyPlans.filter(
        plan => plan.lessonId !== id
    );

    state.lessons = state.lessons.filter(
        item => item.id !== id
    );

    save();
    alert("درس و تمام اطلاعات وابسته به آن حذف شدند.");
}

function editResource(id) {

    const resource = resourceOf(id);

    if (!resource) return;

    const lessonOptions = state.lessons.map(lesson => `

        <option value="${lesson.id}" ${lesson.id === resource.lessonId ? "selected" : ""}>

            ${escapeHTML(lesson.name)} (${escapeHTML(lesson.code)})

        </option>

    `).join("");

    openModal("ویرایش منبع", `

        <label>درس</label>

        <select id="modalLesson">${lessonOptions}</select>

        <label>نام منبع</label>

        <input id="modalName" value="${escapeHTML(resource.name)}" required>

        <label>تعداد کل صفحات</label>

        <input id="modalPages" type="number" min="1" value="${resource.totalPages}" required>

    `, () => {

        const lessonId = $("modalLesson").value;

        const name = $("modalName").value.trim();

        const pages = Number($("modalPages").value);

        const used = studiedPages(id);

        if (!lessonOf(lessonId) || !name || !Number.isInteger(pages) || pages < 1) {

            alert("اطلاعات منبع معتبر نیست.");

            return false;

        }

        if (pages < used) {

            alert(`تعداد کل صفحات نمی‌تواند کمتر از ${faDigits(used)} صفحه ثبت‌شده باشد.`);

            return false;

        }

        resource.lessonId = lessonId;

        resource.name = name;

        resource.totalPages = pages;

        return true;

    });

}

$("editForm").addEventListener("submit", event => {

    event.preventDefault();

    if (!editing) return;

    if (editing() !== false) {

        closeModal();

        save();

    }

});

$("closeModal").addEventListener("click", closeModal);

$("modal").addEventListener("click", event => {

    if (event.target === $("modal")) closeModal();

});

/* Add Lesson */

$("lessonForm").addEventListener("submit", event => {

    event.preventDefault();

    const name = $("lessonName").value.trim();

    const code = $("lessonCode").value.trim().toUpperCase();

    if (!name || !/^[A-Z0-9_-]+$/.test(code)) {

        alert("شناسه درس را با حروف انگلیسی، عدد، خط تیره یا زیرخط وارد کن.");

        return;

    }

    if (state.lessons.some(item => item.code.toUpperCase() === code)) {

        alert("این کلمه قبلاً برای درس دیگری ثبت شده است.");

        return;

    }

    state.lessons.push({

        id: uid(),

        name,

        code,

        createdAt: todayISO()

    });

    event.target.reset();

    save();

});

/* Add Resource */

$("resourceForm").addEventListener("submit", event => {

    event.preventDefault();

    const lessonId = $("resourceLesson").value;

    const name = $("resourceName").value.trim();

    const totalPages = Number($("resourcePages").value);

    if (!lessonOf(lessonId) || !name || !Number.isInteger(totalPages) || totalPages < 1) {

        alert("اطلاعات منبع را بررسی کن.");

        return;

    }

    state.resources.push({

        id: uid(),

        lessonId,

        name,

        totalPages,

        createdAt: todayISO()

    });

    event.target.reset();

    save();

});

/* Form Connections */

$("studyLesson").addEventListener("change", () => {
    renderResourceOptions();
    updateStudyPreview();
});

$("addStudyResource").addEventListener("click", () => addResourceRow("studyResources", $("studyLesson").value));

$("partLessonFilter").addEventListener("change", renderParts);

$("planForm").addEventListener("submit", addDailyPlan);

$("planDate").addEventListener("change", renderDailyPlan);

$("planTodayBtn").addEventListener("click", () => {

    $("planDate").value = isoToJalali(todayISO());

    renderDailyPlan();

});

/* Register Study Session */

$("studyForm").addEventListener("submit", event => {
    event.preventDefault();
    const lessonId = $("studyLesson").value;
    const lesson = lessonOf(lessonId);
    const entries = readResourceRows("studyResources");
    const date = jalaliToISO($("studyDate").value);
    const notes = $("studyNotes").value.trim();
    if (!lesson) { alert("ابتدا یک درس انتخاب کن."); return; }
    if (!validateResourceEntries(lessonId, entries)) return;
    if (!date) { alert("تاریخ شمسی را به شکل روز/ماه/سال وارد کن."); return; }
    const today = todayISO();
    let scheduleBaseDate = date;
    if (date < today) {
        const useToday = confirm(`تاریخ مطالعه ${formatDate(date)} قبل از امروز است.\n\nاگر OK را بزنی، مرورها از امروز برنامه‌ریزی می‌شوند.\nاگر Cancel را بزنی، مرورها از تاریخ واقعی مطالعه برنامه‌ریزی می‌شوند.`);
        scheduleBaseDate = useToday ? today : date;
    }
    const code = lessonNextCode(lessonId);
    const part = { id: uid(), lessonId, resources: entries, code, date, scheduleBaseDate, notes, createdAt: todayISO() };
    state.parts.push(part);
    state.reviews.push(...createReviews(part));
    event.target.reset();
    $("studyDate").value = isoToJalali(todayISO());
    renderStudyResourceRows($("studyLesson").value);
    save();
    alert(`مطالعه ثبت شد. پارت ${code} ساخته شد و ۸ مرور برای کل پارت برنامه‌ریزی شد.`);
});

/* Daily Performance */

$("dailyForm").addEventListener("submit", event => {

    event.preventDefault();

    const date = jalaliToISO($("dailyDate").value);

    const item = {

        id: uid(),

        date,

        hours: Number($("dailyHours").value || 0),

        tests: Number($("dailyTests").value || 0),

        correct: Number($("correct").value || 0),

        wrong: Number($("wrong").value || 0),

        blank: Number($("blank").value || 0),

        notes: $("dailyNotes").value.trim()

    };

    if (!date) {

        alert("تاریخ شمسی را به شکل روز/ماه/سال وارد کن.");

        return;

    }

    const values = [

        item.hours,

        item.tests,

        item.correct,

        item.wrong,

        item.blank

    ];

    if (values.some(value => !Number.isFinite(value) || value < 0)) {

        alert("مقادیر عملکرد باید صفر یا بیشتر باشند.");

        return;

    }

    if (item.correct + item.wrong + item.blank > item.tests) {

        alert("مجموع صحیح، غلط و نزده نمی‌تواند از تعداد کل تست بیشتر باشد.");

        return;

    }

    state.daily.push(item);

    event.target.reset();

    $("dailyDate").value = isoToJalali(todayISO());

    save();

});

/* Review Filters */

document.querySelectorAll(".filter-btn").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".filter-btn").forEach(b => {

            b.classList.remove("active");

        });

        button.classList.add("active");

        reviewFilter = button.dataset.filter;

        renderReviews();

    });

});

/* Navigation */

document.querySelectorAll(".nav-btn").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".nav-btn").forEach(b => {

            b.classList.remove("active");

        });

        document.querySelectorAll(".page").forEach(page => {

            page.classList.remove("active");

        });

        button.classList.add("active");

        $(button.dataset.page).classList.add("active");

    });

});

/* Backup */

$("exportBtn").addEventListener("click", () => {

    const blob = new Blob(

        [JSON.stringify(state, null, 2)],

        { type: "application/json" }

    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `study-tracker-${todayISO()}.json`;

    link.click();

    URL.revokeObjectURL(url);

});

$("importBtn").addEventListener("click", async () => {

    const file = $("importFile").files[0];

    if (!file) {

        alert("ابتدا فایل پشتیبان را انتخاب کن.");

        return;

    }

    try {

        const imported = JSON.parse(await file.text());

        if (

            !Array.isArray(imported.lessons) ||

            !Array.isArray(imported.resources) ||

            !Array.isArray(imported.parts) ||

            !Array.isArray(imported.reviews) ||

            !Array.isArray(imported.daily)

        ) {

            throw new Error("Invalid backup structure");

        }

        if (!confirm("اطلاعات فعلی با فایل پشتیبان جایگزین شود؟")) {

            return;

        }

        state = {

            lessons: imported.lessons,

            resources: imported.resources,

            parts: imported.parts.map(part => ({

                ...part,

                scheduleBaseDate: part.scheduleBaseDate || part.date

            })),

            reviews: imported.reviews,

            daily: imported.daily,

            dailyPlans: Array.isArray(imported.dailyPlans)

                ? imported.dailyPlans

                : []

        };

        save();

        alert("بازیابی اطلاعات انجام شد.");

    } catch {

        alert("فایل پشتیبان معتبر نیست یا با ساختار این نسخه سازگار نیست.");

    }

});

/* Jalali Inputs */

function initializeJalaliInputs() {

    document.querySelectorAll(".jalali-date").forEach(input => {

        if (!input.value.trim()) {

            input.value = isoToJalali(todayISO());

        }

        input.addEventListener("blur", () => {

            const iso = jalaliToISO(input.value);

            if (!iso && input.value.trim()) {

                input.setCustomValidity("تاریخ را به شکل روز/ماه/سال شمسی وارد کن.");

            } else {

                input.setCustomValidity("");

                if (iso) {

                    input.value = isoToJalali(iso);

                }

            }

        });

        input.addEventListener("input", () => {

            input.setCustomValidity("");

        });

    });

}

initializeJalaliInputs();
if ($("studyResources")) renderStudyResourceRows($("studyLesson").value);

render();

window.StudyTracker = {
    getState: () => structuredClone(state),

    switchAccount: userId => {
        const nextKey = userId
            ? `${KEY}:user:${userId}`
            : ANONYMOUS_KEY;

        if (nextKey === activeStorageKey) return;

        // انتقال اطلاعات قدیمی فقط به اولین حساب
        if (
            userId &&
            !localStorage.getItem(nextKey) &&
            !localStorage.getItem(LEGACY_CLAIM_KEY)
        ) {
            const legacy = localStorage.getItem(KEY);

            if (legacy) {
                localStorage.setItem(nextKey, legacy);
                localStorage.setItem(LEGACY_CLAIM_KEY, userId);
            }
        }

        activeStorageKey = nextKey;
        state = loadState(activeStorageKey);
        render();
    },

    replaceState: nextState => {
        state = {
            lessons: Array.isArray(nextState?.lessons) ? nextState.lessons : [],
            resources: Array.isArray(nextState?.resources) ? nextState.resources : [],
            parts: Array.isArray(nextState?.parts) ? nextState.parts : [],
            reviews: Array.isArray(nextState?.reviews) ? nextState.reviews : [],
            daily: Array.isArray(nextState?.daily) ? nextState.daily : [],
            dailyPlans: Array.isArray(nextState?.dailyPlans) ? nextState.dailyPlans : []
        };

        localStorage.setItem(activeStorageKey, JSON.stringify(state));
        render();
    }
};
