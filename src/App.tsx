import React, { useMemo, useState } from "react";
import "./App.css";

type Tab = "home" | "order" | "contact";

type FormState = {
  cakeOriginalQty: number;
  cakeMatchaQty: number;
  cakeChocolateQty: number;

  cookieOriginalQty: number;
  cookieStrawberryQty: number;

  strawberryBasqueQty: number;

  fullName: string;
  email: string;
  phone: string;
  pickupOption: string;
  note: string;

  agreePayment: boolean;
};

const FORM_ENDPOINT = import.meta.env.VITE_FORM_ENDPOINT as string;

const INITIAL_STATE: FormState = {
  cakeOriginalQty: 0,
  cakeMatchaQty: 0,
  cakeChocolateQty: 0,

  cookieOriginalQty: 0,
  cookieStrawberryQty: 0,

  strawberryBasqueQty: 0,

  fullName: "",
  email: "",
  phone: "",
  pickupOption: "",
  note: "",
  agreePayment: false,
};

const PRICE = {
  cakeOriginal: 25,
  cakeMatcha: 28,
  cakeChocolate: 28,
  cookieOriginal: 8,
  cookieStrawberry: 9.5,
  strawberryBasque: 13,
};

const PICKUP = {
  friday: {
    label: "Fri / La Jolla / 7:00–7:30 PM",
    place: "Whole Foods Market Parking Lot",
    address: "8825 Villa La Jolla Dr, La Jolla, CA 92037",
    line: "Friday: La Jolla Whole Foods Market Parking Lot — 8825 Villa La Jolla Dr, La Jolla, CA 92037 · 7:00–7:30 PM",
  },
  saturday: {
    label: "Sat / Convoy / 2:00–2:30 PM",
    place: "HIVE / Paik's Noodle",
    address: "4428 Convoy St, San Diego, CA 92111",
    line: "Saturday: Convoy HIVE / Paik's Noodle — 4428 Convoy St, San Diego, CA 92111 · 2:00–2:30 PM",
  },
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7;
}

// ---- Date helpers ----
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function formatISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatShort(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function generatePickupOptions(weeksAhead = 8) {
  const today = startOfDay(new Date());
  const options: Array<{ value: string; label: string; detail: string }> = [];

  const dow = today.getDay(); // Sun=0 ... Sat=6

  // 이번 주 금요일/토요일 날짜 계산
  const daysUntilFriday = (5 - dow + 7) % 7;
  const thisFriday = addDays(today, daysUntilFriday);
  const thisSaturday = addDays(thisFriday, 1);

  for (let w = 0; w < weeksAhead; w++) {
    const fri = addDays(thisFriday, 7 * w);
    const sat = addDays(thisSaturday, 7 * w);

    // ---- 컷오프 규칙 ----
    // 목요일에 주문하면 이번주 금요일 픽업 불가
    // 금요일에 주문하면 이번주 토요일 픽업 불가
    const blockThisWeekFriday = w === 0 && dow === 4; // Thu
    const blockThisWeekSaturday = w === 0 && dow === 5; // Fri

    if (fri >= today && !blockThisWeekFriday) {
      options.push({
        value: `FRI|${formatISODate(fri)}`,
        label: `${formatShort(fri)} · ${PICKUP.friday.label}`,
        detail: `${PICKUP.friday.place} — ${PICKUP.friday.address}`,
      });
    }

    if (sat >= today && !blockThisWeekSaturday) {
      options.push({
        value: `SAT|${formatISODate(sat)}`,
        label: `${formatShort(sat)} · ${PICKUP.saturday.label}`,
        detail: `${PICKUP.saturday.place} — ${PICKUP.saturday.address}`,
      });
    }
  }

  return options;
}

/** ✅ iOS/Instagram 브라우저에서 number spinner가 안 떠서,
 *  - / + 스테퍼로 수량 조절 가능하게 만든 컴포넌트
 */
function QtyStepper(props: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
}) {
  const { value, min = 0, max = 999, onChange, ariaLabel } = props;

  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="qtyStepper" aria-label={ariaLabel}>
      <button
        type="button"
        className="qtyBtn"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease"
      >
        −
      </button>

      <input
        type="text"
        className="qtyInput"
        inputMode="numeric"
        pattern="[0-9]*"
        value={String(value)}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^\d]/g, "");
          const n = cleaned === "" ? 0 : Number(cleaned);
          if (Number.isNaN(n)) return;
          onChange(Math.min(max, Math.max(min, n)));
        }}
      />

      <button
        type="button"
        className="qtyBtn"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");


  const pickupOptions = useMemo(() => generatePickupOptions(10), []);

  const totals = useMemo(() => {
    const cheesecakeTotal = form.cakeOriginalQty + form.cakeMatchaQty + form.cakeChocolateQty;
    const strawberryBasqueTotal = form.strawberryBasqueQty;

    const cakeTotal = cheesecakeTotal + strawberryBasqueTotal;
    const cookieTotal = form.cookieOriginalQty + form.cookieStrawberryQty;

    const subtotal =
      form.cakeOriginalQty * PRICE.cakeOriginal +
      form.cakeMatchaQty * PRICE.cakeMatcha +
      form.cakeChocolateQty * PRICE.cakeChocolate +
      form.strawberryBasqueQty * PRICE.strawberryBasque +
      form.cookieOriginalQty * PRICE.cookieOriginal +
      form.cookieStrawberryQty * PRICE.cookieStrawberry;

    return { cakeTotal, cookieTotal, subtotal };
  }, [form]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    // If no cake, cookies must be >= 2
    if (totals.cakeTotal === 0 && totals.cookieTotal < 2) {
      e.minOrder = "If you’re not ordering a cake, please order at least 2 cookies (mix & match allowed).";
    }

    // Cookies > 10 -> DM
    if (form.cookieOriginalQty > 10 || form.cookieStrawberryQty > 10) {
      e.maxCookie = "If you want to order more than 10 cookies, please DM @umai_dubai_sd.";
    }

    if (!form.fullName.trim()) e.fullName = "Full name is required.";
    if (!form.email.trim()) e.email = "Email is required.";
    else if (!isValidEmail(form.email)) e.email = "Please enter a valid email.";

    if (!form.phone.trim()) e.phone = "Phone number is required.";
    else if (!isValidPhone(form.phone)) e.phone = "Please enter a valid phone number.";

    if (!form.pickupOption.trim()) e.pickupOption = "Please select a pickup date & location.";

    if (!form.agreePayment) e.agreePayment = "Please confirm you read the payment instructions.";

    if (totals.subtotal <= 0) e.nothing = "Please select at least one item.";

    return e;
  }, [form, totals]);

  const hasErrors = Object.keys(errors).length > 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setStatusMsg("");
    }
  }

  function markTouched(key: string) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  function resetAll() {
    setForm(INITIAL_STATE);
    setTouched({});
    setStatus("idle");
    setStatusMsg("");
  }

  const goTab = (t: Tab) => {
    setTab(t);

    // ---- Google Analytics 4: 탭 전환 이벤트 전송 ----
    (window as any).gtag?.("event", "tab_view", { tab: t });

    requestAnimationFrame(() => {
      const header = document.querySelector(".topbar") as HTMLElement | null;
      const h = header ? header.getBoundingClientRect().height : 0;
      window.scrollTo({ top: 0 + Math.ceil(h) + 12, behavior: "auto" });
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setTouched({
      minOrder: true,
      maxCookie: true,
      fullName: true,
      email: true,
      phone: true,
      pickupOption: true,
      agreePayment: true,
      nothing: true,
    });

    if (Object.keys(errors).length > 0) return;

    setStatus("submitting");
    setStatusMsg("");

    try {
      const pickupLabel =
        pickupOptions.find((x) => x.value === form.pickupOption)?.label || form.pickupOption;

      const items: string[] = [];
      if (form.cakeOriginalQty > 0) items.push(`Basque Cheesecake (Original) x${form.cakeOriginalQty}`);
      if (form.cakeMatchaQty > 0) items.push(`Basque Cheesecake (Matcha) x${form.cakeMatchaQty}`);
      if (form.cakeChocolateQty > 0) items.push(`Basque Cheesecake (Chocolate) x${form.cakeChocolateQty}`);
      if (form.cookieOriginalQty > 0) items.push(`Dubai Chewy Cookie (Original) x${form.cookieOriginalQty}`);
      if (form.cookieStrawberryQty > 0) items.push(`Dubai Chewy Cookie (Strawberry) x${form.cookieStrawberryQty}`);
      // if (form.strawberryBasqueQty > 0) items.push(`Dubai Strawberry Basque Mini Cake x${form.strawberryBasqueQty}`);

      const payload = {
        cakeOriginalQty: form.cakeOriginalQty,
        cakeMatchaQty: form.cakeMatchaQty,
        cakeChocolateQty: form.cakeChocolateQty,
        cookieOriginalQty: form.cookieOriginalQty,
        cookieStrawberryQty: form.cookieStrawberryQty,
        strawberryBasqueQty: form.strawberryBasqueQty,

        subtotalUSD: Number(totals.subtotal.toFixed(2)),
        itemsSummary: items.join(", "),

        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        pickupOptionRaw: form.pickupOption,
        pickupLabel,
        note: form.note || "",

        paymentInstructionsAck: form.agreePayment ? "yes" : "no",
      };

      await fetch(FORM_ENDPOINT, {
        method: "POST",
        mode: "no-cors", // ✅ 응답을 못 읽어도 서버에는 전송됨(시트에 append 가능)
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      window.location.assign("/thanks.html");
    } catch {
      setStatus("error");
      setStatusMsg("Network error. Please check your connection and try again.");
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brandLogo" src="/menu/profile1.jpg" alt="Umai Bakery logo" />

          <div className="brandText">
            <div className="brandTitle">Umai Bakery</div>
            <div className="brandSub">@umai_dubai_sd · Pre-Order</div>
          </div>
        </div>

        <nav className="tabs" aria-label="Primary">
          <button className={tab === "home" ? "tab active" : "tab"} onClick={() => goTab("home")} type="button">
            Home
          </button>
          <button className={tab === "order" ? "tab active" : "tab"} onClick={() => goTab("order")} type="button">
            Pre-Order
          </button>
          <button className={tab === "contact" ? "tab active" : "tab"} onClick={() => goTab("contact")} type="button">
            Contact
          </button>
        </nav>
      </header>

      <main className="container">
        {tab === "home" && (
          <section className="card">
            <h1 className="h1">Umai Dubai Pre-Order</h1>
            <p className="lead" style={{ marginBottom: 14 }}>
              We’re so glad you’re here! Try our homemade desserts!
            </p>

            <div className="menuBoard" style={{ marginTop: 0 }}>
              <h3 className="h3">Menu</h3>

              <div className="menuPosterWrap">
                <img className="menuPosterImg" src="/menu/menu-board.jpg" alt="Umai Bakery Menu" />
              </div>

              <div className="menuCTA">
                <button className="primary" onClick={() => goTab("order")} type="button">
                  Pre-order here →
                </button>
              </div>
            </div>

            <div className="grid2 homeRow" style={{ marginTop: 14 }}>
              <div className="info">
                <h3 className="h3">Minimum order</h3>

                <p className="p">
                  <b>Dubai Chewy Cookies:</b> Minimum order is <b>2 cookies</b> (mix & match allowed).
                  <br />
                  최소 주문 수량은 <b>2개</b>이며 맛을 섞어서 주문하셔도 됩니다.
                </p>

                <p className="p">
                  <b>Cheesecake:</b> cake can be ordered by itself.
                  <br />
                  바스크 치즈 케이크는 <b>단독</b> 주문 가능합니다.
                </p>

                <p className="p" style={{ marginBottom: 0 }}>
                  <b>Dubai Strawberry Basque Mini Cake:</b> cake can be ordered by itself. (Not available now)
                  <br />
                  두바이 딸기 떠먹케는 <b>단독</b> 주문 가능합니다. (현재는 주문 불가)
                </p>
              </div>

              <div className="info">
                <h3 className="h3">Pickup schedule (fixed)</h3>
                <div className="pickupList">
                  <div className="pickupItem">
                    <div className="pickupDay">Friday (La Jolla)</div>
                    <div className="pickupMeta">
                      <div>
                        <b>Time:</b> 7:00–7:30 PM
                      </div>
                      <div>
                        <b>Location:</b> Whole Foods Market Parking Lot
                      </div>
                      <div className="pickupAddr">📍 8825 Villa La Jolla Dr, La Jolla, CA 92037</div>
                    </div>
                  </div>
                  <br />
                  <div className="pickupItem">
                    <div className="pickupDay">Saturday (Convoy)</div>
                    <div className="pickupMeta">
                      <div>
                        <b>Time:</b> 2:00–2:30 PM
                      </div>
                      <div>
                        <b>Location:</b> HIVE / Paik's Noodle
                      </div>
                      <div className="pickupAddr">📍 4428 Convoy St, San Diego, CA 92111</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "order" && (
          <section className="card">
            <h1 className="h1">Pre-Order</h1>

            <form className="form" onSubmit={onSubmit} noValidate>
              <div className="grid2">
                {/* LEFT COLUMN */}
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="info">
                    <h3 className="h3">Mini Basque Burnt Cheesecake (5")</h3>
                    <img className="sectionImg" src="/menu/basque-cheesecake.jpg" alt='Mini Basque Burnt Cheesecake (5")' />

                    <div className="field">
                      <label>Original — $25</label>
                      <QtyStepper
                        value={form.cakeOriginalQty}
                        min={0}
                        onChange={(n) => update("cakeOriginalQty", n)}
                        ariaLabel="Cheesecake Original quantity"
                      />
                    </div>

                    <div className="field">
                      <label>Matcha — $28</label>
                      <QtyStepper
                        value={form.cakeMatchaQty}
                        min={0}
                        onChange={(n) => update("cakeMatchaQty", n)}
                        ariaLabel="Cheesecake Matcha quantity"
                      />
                    </div>

                    <div className="field">
                      <label>Chocolate — $28</label>
                      <QtyStepper
                        value={form.cakeChocolateQty}
                        min={0}
                        onChange={(n) => update("cakeChocolateQty", n)}
                        ariaLabel="Cheesecake Chocolate quantity"
                      />
                    </div>
                  </div>

                  {/* ✅ Dubai Strawberry Basque Mini Cake (주문 불가라 주석 유지) */}
                  {/* <div className="info">
                    <h3 className="h3">Dubai Strawberry Basque Mini Cake</h3>
                    <img className="sectionImg" src="/menu/strawberry-basque.jpg" alt="Dubai Strawberry Basque Mini Cake" />

                    <div className="field" style={{ marginTop: 10 }}>
                      <label>Quantity — $13</label>
                      <QtyStepper
                        value={form.strawberryBasqueQty}
                        min={0}
                        onChange={(n) => update("strawberryBasqueQty", n)}
                        ariaLabel="Strawberry Basque quantity"
                      />
                    </div>
                  </div> */}
                </div>

                {/* RIGHT COLUMN */}
                <div className="info">
                  <h3 className="h3">Dubai Chewy Cookies</h3>
                  <img className="sectionImg" src="/menu/dubai-cookie.jpg" alt="Dubai Chewy Cookie" />

                  <p className="p" style={{ marginTop: 10 }}>
                    If you want to order more than 10, please DM <b>@umai_dubai_sd</b>.
                    <br />
                    10개 이상 주문을 원하시면 <b>@umai_dubai_sd</b> 인스타그램 DM으로 연락 주세요.
                  </p>

                  <div className="field">
                    <label>Original — $8</label>
                    <QtyStepper
                      value={form.cookieOriginalQty}
                      min={0}
                      max={10}
                      onChange={(n) => update("cookieOriginalQty", n)}
                      ariaLabel="Cookie Original quantity"
                    />
                  </div>

                  <div className="field">
                    <label>Strawberry — $9.5</label>
                    <QtyStepper
                      value={form.cookieStrawberryQty}
                      min={0}
                      max={10}
                      onChange={(n) => update("cookieStrawberryQty", n)}
                      ariaLabel="Cookie Strawberry quantity"
                    />
                  </div>
                </div>
              </div>

              {(touched.minOrder || touched.nothing) && errors.minOrder && <div className="errorBox">{errors.minOrder}</div>}
              {touched.maxCookie && errors.maxCookie && <div className="errorBox">{errors.maxCookie}</div>}
              {touched.nothing && errors.nothing && <div className="errorBox">{errors.nothing}</div>}

              <div className="policy">
                <h3 className="h3">Subtotal</h3>
                <p className="p">
                  <b>${totals.subtotal.toFixed(2)}</b>
                </p>
              </div>

              <h3 className="h3">Customer Info</h3>

              <div className="field">
                <label>
                  Full Name <span className="req">*</span>
                </label>
                <input
                  value={form.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  onBlur={() => markTouched("fullName")}
                  placeholder="First + Last"
                />
                {touched.fullName && errors.fullName && <div className="error">{errors.fullName}</div>}
              </div>

              <div className="row">
                <div className="field">
                  <label>
                    Email for Order Confirmation <span className="req">*</span>
                  </label>
                  <input
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    onBlur={() => markTouched("email")}
                    placeholder="you@example.com"
                    inputMode="email"
                    autoComplete="email"
                  />
                  {touched.email && errors.email && <div className="error">{errors.email}</div>}
                </div>

                <div className="field">
                  <label>
                    Phone Number <span className="req">*</span>
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    onBlur={() => markTouched("phone")}
                    placeholder="+1 (___) ___-____"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  {touched.phone && errors.phone && <div className="error">{errors.phone}</div>}
                </div>
              </div>

              <div className="field">
                <label>
                  Pickup Date & Location <span className="req">*</span>
                </label>
                <select
                  value={form.pickupOption}
                  onChange={(e) => update("pickupOption", e.target.value)}
                  onBlur={() => markTouched("pickupOption")}
                >
                  <option value="">Select…</option>
                  {pickupOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {touched.pickupOption && errors.pickupOption && <div className="error">{errors.pickupOption}</div>}

                <div className="hint" style={{ marginTop: 10 }}>
                  <b>La Jolla (Fri)</b>: {PICKUP.friday.place} — {PICKUP.friday.address}
                  <br />
                  <b>Convoy (Sat)</b>: {PICKUP.saturday.place} — {PICKUP.saturday.address}
                </div>
              </div>

              <div className="policy">
                <h3 className="h3">Payment</h3>
                <img className="venmo" src="/menu/venmo.jpg" alt="umai venmo" />
                <p className="p">
                  <b>Venmo:</b> @umai__dubai (Umai Bakery) <br />
                  * There are two underscores, not one. (“__”) <br />
                  * If Venmo payment fails due to a security check, please add our account as a friend and try again. <br />
                  * 2048: the last 4 digit of recipient’s contact number (in case Venmo asks for verification) <br />
                  * Please make sure your Venmo name matches the name on your order. If not, DM @umai_dubai_sd. <br />
                  * If you’re unable to use Venmo, please DM @umai_dubai_sd. <br />
                  * Your order will be confirmed once payment is completed within 24 hours of submitting the order form.
                  <br />
                  <br />
                  주문자 이름과 Venmo 이름이 동일한지 확인 부탁드립니다. 이름이 다를 경우 @umai_dubai_sd DM으로 알려주세요. <br />
                  주문서 작성 후 <b>24시간 이내</b>에 입금하시면 주문이 완료됩니다.
                </p>
              </div>

              <div className="field checkboxRow">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.agreePayment}
                    onChange={(e) => update("agreePayment", e.target.checked)}
                    onBlur={() => markTouched("agreePayment")}
                  />
                  I have read the payment instructions <span className="req">*</span>
                </label>
                {touched.agreePayment && errors.agreePayment && <div className="error">{errors.agreePayment}</div>}
              </div>

              <div className="field">
                <label>Note (optional)</label>
                <textarea
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                  placeholder="Anything we should know?"
                  rows={4}
                />
              </div>

              <div className="actions">
                <button className="primary" type="submit" disabled={hasErrors || status === "submitting"}>
                  {status === "submitting" ? "Sending..." : "Submit"}
                </button>

                <button className="secondary" type="button" onClick={resetAll} disabled={status === "submitting"}>
                  Reset
                </button>
              </div>

              {status === "error" && <div className="errorBox">{statusMsg}</div>}
            </form>
          </section>
        )}

        {tab === "contact" && (
          <div className="contactWrap">
            <section className="card contactCard">
              <h1 className="h1">Contact</h1>
              <p className="lead">
                Fastest: Instagram DM <b>@umai_dubai_sd</b>
              </p>

              <div className="grid2">
                <div className="info">
                  <h3 className="h3">Instagram</h3>
                  <p className="p" style={{ marginBottom: 0 }}>
                    @umai_dubai_sd
                  </p>
                </div>

                <div className="info">
                  <h3 className="h3">Pickup</h3>
                  <p className="p" style={{ marginBottom: 0 }}>
                    Fri — La Jolla (7:00–7:30 PM)
                    <br />
                    Sat — Convoy (2:00–2:30 PM)
                  </p>
                </div>
              </div>

              <div className="policy allergyBox">
                <h3 className="h3">Allergy / Ingredients Notice</h3>
                <p className="p" style={{ marginBottom: 0 }}>
                  Contains <b>wheat</b> (kadayif), <b>dairy</b> (butter, milk/cream), <b>eggs</b>, and <b>tree nuts</b>{" "}
                  (pistachio).
                  <br />
                  Made in a kitchen that may also handle other allergens.
                  <br />
                  <br />
                  <b>알레르기 안내:</b> 본 제품은 <b>밀</b>(카다이프), <b>유제품</b>(버터/우유/크림), <b>계란</b>, <b>견과류</b>(피스타치오)를
                  포함합니다.
                  <br />
                  다른 알레르기 유발 성분을 다루는 주방에서 함께 제조될 수 있습니다.
                </p>
              </div>

              <button className="primary" onClick={() => goTab("order")} type="button">
                Pre-Order now →
              </button>
            </section>
          </div>
        )}
      </main>

      <footer className="footer">
        <div>© {new Date().getFullYear()} Umai Bakery</div>
      </footer>
    </div>
  );
}
