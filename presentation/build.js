// Garage OnDemand — final-year project presentation
// Run with:  node build.js
// Output:    GarageOnDemand.pptx

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

const {
  FaCar, FaWrench, FaCalendarAlt, FaCreditCard, FaKey, FaUserShield,
  FaChartLine, FaProjectDiagram, FaCode, FaDatabase, FaPalette,
  FaServer, FaPlug, FaShieldAlt, FaFlask, FaBolt, FaSearch,
  FaCheckCircle, FaLock, FaEnvelope, FaGoogle, FaCogs, FaBrain,
  FaFileCsv, FaUsers, FaListUl, FaWarehouse, FaMobileAlt, FaCloud,
  FaArrowRight, FaPython, FaVuejs, FaTools
} = require("react-icons/fa");

// ─── Theme ────────────────────────────────────────────────────────────
const C = {
  primary:   "4F46E5", // indigo-600
  secondary: "7C3AED", // violet-600
  dark:      "0F172A", // slate-900
  darkAlt:   "1E1B4B", // indigo-950
  bg:        "F8FAFC", // slate-50
  card:      "FFFFFF",
  text:      "1E293B", // slate-800
  textInv:   "F8FAFC",
  muted:     "64748B", // slate-500
  mutedInv:  "94A3B8", // slate-400
  border:    "E2E8F0", // slate-200
  borderDk:  "334155", // slate-700
  green:     "10B981",
  amber:     "F59E0B",
  pink:      "EC4899",
  cyan:      "06B6D4",
};

const HEADER_FONT = "Calibri";
const BODY_FONT = "Calibri";

// ─── Icon rendering ───────────────────────────────────────────────────
function renderIconSvg(Icon, color, size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(Icon, { color, size: String(size) })
  );
}
async function icon(Icon, color = "#FFFFFF") {
  const svg = renderIconSvg(Icon, color, 256);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ─── Reusable elements ────────────────────────────────────────────────
function logoBadge(slide, x, y, size = 0.5, dark = false) {
  slide.addShape(pptx.shapes.OVAL, {
    x, y, w: size, h: size,
    fill: { color: dark ? C.primary : C.primary },
    line: { color: dark ? C.primary : C.primary, width: 0 },
  });
  slide.addText("G", {
    x, y, w: size, h: size,
    fontFace: HEADER_FONT, fontSize: size * 28, bold: true,
    color: "FFFFFF", align: "center", valign: "middle",
    margin: 0,
  });
}

function slideHeader(slide, title, kicker) {
  logoBadge(slide, 0.45, 0.35, 0.4);
  slide.addText(kicker || "", {
    x: 1.0, y: 0.32, w: 8.5, h: 0.3,
    fontFace: BODY_FONT, fontSize: 10, color: C.muted, bold: true,
    charSpacing: 4, margin: 0,
  });
  slide.addText(title, {
    x: 1.0, y: 0.52, w: 8.5, h: 0.55,
    fontFace: HEADER_FONT, fontSize: 28, bold: true, color: C.text,
    margin: 0,
  });
  // No accent line — relies on whitespace for separation
}

function footer(slide, n, total) {
  slide.addText(`${n} / ${total}`, {
    x: 9.0, y: 5.2, w: 0.9, h: 0.3,
    fontFace: BODY_FONT, fontSize: 9, color: C.muted, align: "right",
    margin: 0,
  });
  slide.addText("Garage OnDemand", {
    x: 0.45, y: 5.2, w: 5, h: 0.3,
    fontFace: BODY_FONT, fontSize: 9, color: C.muted,
    margin: 0,
  });
}

// ─── Build ────────────────────────────────────────────────────────────
const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9"; // 10 × 5.625 in
pptx.author = "xtfee";
pptx.title = "Garage OnDemand";

const TOTAL = 17;

(async () => {

  // Pre-render icons
  const I = {
    car:        await icon(FaCar,        "#FFFFFF"),
    wrench:     await icon(FaWrench,     "#FFFFFF"),
    cal:        await icon(FaCalendarAlt,"#FFFFFF"),
    pay:       await icon(FaCreditCard, "#FFFFFF"),
    key:       await icon(FaKey,        "#FFFFFF"),
    shield:    await icon(FaUserShield, "#FFFFFF"),
    chart:     await icon(FaChartLine,  "#FFFFFF"),
    diagram:   await icon(FaProjectDiagram,"#FFFFFF"),
    code:      await icon(FaCode,       "#FFFFFF"),
    db:        await icon(FaDatabase,   "#FFFFFF"),
    palette:   await icon(FaPalette,    "#FFFFFF"),
    server:    await icon(FaServer,     "#FFFFFF"),
    plug:      await icon(FaPlug,       "#FFFFFF"),
    lock:      await icon(FaLock,       "#FFFFFF"),
    flask:     await icon(FaFlask,      "#FFFFFF"),
    bolt:      await icon(FaBolt,       "#FFFFFF"),
    search:    await icon(FaSearch,     "#FFFFFF"),
    check:     await icon(FaCheckCircle,"#FFFFFF"),
    mail:      await icon(FaEnvelope,   "#FFFFFF"),
    google:    await icon(FaGoogle,     "#FFFFFF"),
    cogs:      await icon(FaCogs,       "#FFFFFF"),
    brain:     await icon(FaBrain,      "#FFFFFF"),
    csv:       await icon(FaFileCsv,    "#FFFFFF"),
    users:     await icon(FaUsers,      "#FFFFFF"),
    list:      await icon(FaListUl,     "#FFFFFF"),
    warehouse: await icon(FaWarehouse,  "#FFFFFF"),
    mobile:    await icon(FaMobileAlt,  "#FFFFFF"),
    cloud:     await icon(FaCloud,      "#FFFFFF"),
    arrow:     await icon(FaArrowRight, "#94A3B8"),
    arrowD:    await icon(FaArrowRight, "#FFFFFF"),
    python:    await icon(FaPython,     "#FFFFFF"),
    vue:       await icon(FaVuejs,      "#FFFFFF"),
    tools:     await icon(FaTools,      "#FFFFFF"),
    shieldDk:  await icon(FaShieldAlt,  "#FFFFFF"),
  };

  // ─── helper: icon tile ─────────────────────────────────────────
  function iconTile(slide, x, y, size, color, iconData) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y, w: size, h: size,
      fill: { color },
      line: { color, width: 0 },
      rectRadius: 0.08,
    });
    slide.addImage({
      data: iconData,
      x: x + size * 0.22, y: y + size * 0.22,
      w: size * 0.56, h: size * 0.56,
    });
  }

  // ─── helper: feature card ──────────────────────────────────────
  function featureCard(slide, x, y, w, h, iconData, tileColor, title, body) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h,
      fill: { color: C.card },
      line: { color: C.border, width: 0.75 },
      rectRadius: 0.1,
      shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 12, offset: 3, angle: 90 },
    });
    iconTile(slide, x + 0.25, y + 0.25, 0.55, tileColor, iconData);
    slide.addText(title, {
      x: x + 0.25, y: y + 0.9, w: w - 0.5, h: 0.35,
      fontFace: HEADER_FONT, fontSize: 14, bold: true, color: C.text,
      margin: 0,
    });
    slide.addText(body, {
      x: x + 0.25, y: y + 1.25, w: w - 0.5, h: h - 1.35,
      fontFace: BODY_FONT, fontSize: 11, color: C.muted,
      paraSpaceAfter: 4, margin: 0,
    });
  }

  // ─── SLIDE 1 — Title ───────────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.dark };

    // Decorative gradient circles (using semi-transparent ovals).
    // Keep all coordinates non-negative — PowerPoint flags negative offsets.
    s.addShape(pptx.shapes.OVAL, {
      x: 6.5, y: 0, w: 6, h: 6,
      fill: { color: C.primary, transparency: 70 }, line: { color: C.primary, width: 0 },
    });
    s.addShape(pptx.shapes.OVAL, {
      x: 0, y: 3, w: 5, h: 5,
      fill: { color: C.secondary, transparency: 75 }, line: { color: C.secondary, width: 0 },
    });

    // Big G badge
    s.addShape(pptx.shapes.OVAL, {
      x: 0.55, y: 0.5, w: 0.7, h: 0.7,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 },
    });
    s.addText("G", {
      x: 0.55, y: 0.5, w: 0.7, h: 0.7,
      fontFace: HEADER_FONT, fontSize: 36, bold: true,
      color: "FFFFFF", align: "center", valign: "middle", margin: 0,
    });
    s.addText("FINAL PROJECT  ·  2026", {
      x: 1.35, y: 0.55, w: 8, h: 0.5,
      fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.mutedInv,
      charSpacing: 6, valign: "middle", margin: 0,
    });

    // Title
    s.addText("Garage OnDemand", {
      x: 0.55, y: 1.85, w: 9, h: 1.1,
      fontFace: HEADER_FONT, fontSize: 60, bold: true, color: "FFFFFF",
      margin: 0,
    });
    s.addText("Workshop spaces on demand. Like Airbnb — for mechanics.", {
      x: 0.55, y: 2.95, w: 9, h: 0.5,
      fontFace: BODY_FONT, fontSize: 18, color: C.mutedInv, italic: true,
      margin: 0,
    });

    // Stat strip
    const stats = [
      { n: "20", l: "garages" },
      { n: "1,500+", l: "reservations" },
      { n: "17", l: "passing tests" },
      { n: "Vue 3 · Django · ML", l: "stack" },
    ];
    const baseX = 0.55, baseY = 4.0;
    stats.forEach((st, i) => {
      const x = baseX + i * 2.35;
      s.addText(st.n, {
        x, y: baseY, w: 2.2, h: 0.45,
        fontFace: HEADER_FONT, fontSize: 22, bold: true, color: "FFFFFF",
        margin: 0,
      });
      s.addText(st.l.toUpperCase(), {
        x, y: baseY + 0.45, w: 2.2, h: 0.3,
        fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, charSpacing: 4,
        margin: 0,
      });
    });

    s.addText("Bartłomiej · Michał · Oscar    github.com/xtfee/GarageOnDemand", {
      x: 0.55, y: 5.2, w: 9, h: 0.3,
      fontFace: BODY_FONT, fontSize: 10, color: C.mutedInv,
      margin: 0,
    });

    s.addNotes(
      "Hi everyone. We're presenting Garage OnDemand — a workshop reservation platform we built as a group project. " +
      "Think of it as Airbnb but for mechanics: you book a fully-equipped garage by the hour or day " +
      "instead of buying expensive tools yourself. We built it with Vue 3 on the frontend, Django REST Framework " +
      "on the backend, plus a small machine-learning module that mines patterns from reservation history. " +
      "Let us walk you through what it does."
    );
  }

  // ─── SLIDE 2 — The Problem ─────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Mechanics need workspace they can’t afford to own", "01 · THE PROBLEM");

    // Left: pain points list
    const pains = [
      { Icon: I.warehouse, t: "No space", d: "Apartments and small homes don't fit a lift, a pit, or a welder." },
      { Icon: I.tools,     t: "Expensive tools",  d: "Owning pro equipment for occasional use rarely pays off." },
      { Icon: I.cogs,      t: "Logistics",        d: "Booking time at a workshop usually means phone calls and paper schedules." },
    ];
    pains.forEach((p, i) => {
      const y = 1.4 + i * 1.05;
      iconTile(s, 0.55, y, 0.65, C.secondary, p.Icon);
      s.addText(p.t, {
        x: 1.4, y, w: 4.5, h: 0.35,
        fontFace: HEADER_FONT, fontSize: 15, bold: true, color: C.text, margin: 0,
      });
      s.addText(p.d, {
        x: 1.4, y: y + 0.36, w: 4.5, h: 0.65,
        fontFace: BODY_FONT, fontSize: 12, color: C.muted, margin: 0,
      });
    });

    // Right: big quote / target
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 6.3, y: 1.35, w: 3.2, h: 3.35,
      fill: { color: C.dark },
      line: { color: C.dark, width: 0 },
      rectRadius: 0.12,
    });
    s.addText("WHO IT'S FOR", {
      x: 6.5, y: 1.5, w: 2.9, h: 0.3,
      fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.mutedInv, charSpacing: 4, margin: 0,
    });
    s.addText("Hobbyists.\nDIY car owners.\nIndependent mechanics.", {
      x: 6.5, y: 1.9, w: 2.9, h: 1.5,
      fontFace: HEADER_FONT, fontSize: 20, bold: true, color: "FFFFFF", margin: 0,
    });
    s.addText("They need pro-grade equipment by the hour, not by the year.", {
      x: 6.5, y: 3.7, w: 2.9, h: 0.9,
      fontFace: BODY_FONT, fontSize: 12, color: C.mutedInv, italic: true, margin: 0,
    });

    footer(s, 2, TOTAL);

    s.addNotes(
      "Why does this matter? Three real problems. Most people don't have space at home for a hydraulic lift " +
      "or a welder. Owning professional tools for occasional projects rarely pays off. And right now, booking " +
      "a workshop usually means phone calls and paper schedules. The target users are hobbyists, DIY car owners, " +
      "and small independent mechanics — people who need pro-grade equipment by the hour, not by the year."
    );
  }

  // ─── SLIDE 3 — The Solution ───────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "A marketplace for workshop bays", "02 · THE SOLUTION");

    s.addText("Hourly rentals of fully-equipped garages, with online booking, payment and an access PIN.",
      { x: 1.0, y: 1.1, w: 8.0, h: 0.45,
        fontFace: BODY_FONT, fontSize: 14, color: C.muted, margin: 0 });

    // Three value props
    const props = [
      { c: C.primary,   Icon: I.search, t: "Discover",  d: "Browse real garages, filter by city, price and equipment." },
      { c: C.secondary, Icon: I.cal,    t: "Reserve",   d: "Drag-and-drop calendar + hourly timeline with live conflict checks." },
      { c: C.green,     Icon: I.pay,    t: "Pay & go",  d: "Stripe checkout, instant access PIN, refunds for early cancels." },
    ];
    props.forEach((p, i) => {
      featureCard(s, 0.55 + i * 3.1, 1.75, 2.85, 2.95, p.Icon, p.c, p.t, p.d);
    });

    // Bottom strip
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.55, y: 4.9, w: 8.95, h: 0.42,
      fill: { color: C.dark }, line: { color: C.dark, width: 0 }, rectRadius: 0.06,
    });
    s.addText("And on the operator side: full admin tools + a BI/ML dashboard for revenue, popularity, and churn prediction.", {
      x: 0.75, y: 4.93, w: 8.6, h: 0.36,
      fontFace: BODY_FONT, fontSize: 11, color: "FFFFFF", italic: true, margin: 0,
    });

    footer(s, 3, TOTAL);

    s.addNotes(
      "The platform handles three things end to end. Discover — you browse garages with real photos and filters. " +
      "Reserve — you pick days and exact hours on a smart calendar. Pay — Stripe checkout, then you get an access PIN. " +
      "On top of that there is a full admin panel with analytics and ML, which we'll show later in the deck."
    );
  }

  // ─── SLIDE 4 — Tech Stack ─────────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Three layers, modern stack", "03 · TECHNOLOGY");

    const cols = [
      {
        c: C.primary, Icon: I.vue, t: "Frontend",
        items: ["Vue 3 (Composition API)", "Vite 7", "Tailwind CSS + DaisyUI", "Chart.js + vue-chartjs", "Stripe.js Elements"],
      },
      {
        c: C.secondary, Icon: I.python, t: "Backend",
        items: ["Python 3 · Django 6", "Django REST Framework", "PostgreSQL", "django-allauth (Google OAuth)", "Stripe SDK · drf-spectacular"],
      },
      {
        c: C.green, Icon: I.brain, t: "Data / ML",
        items: ["Pandas", "Mlxtend — Apriori", "scikit-learn — Decision Tree", "Matplotlib — tree rendering"],
      },
    ];

    cols.forEach((col, i) => {
      const x = 0.55 + i * 3.1;
      const y = 1.35;
      const w = 2.85, h = 3.65;

      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h,
        fill: { color: C.card },
        line: { color: C.border, width: 0.75 },
        rectRadius: 0.1,
        shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 12, offset: 3, angle: 90 },
      });

      // Top color band — using RECTANGLE for clean alignment with rounded card is risky;
      // instead we put an icon tile that brands the card.
      iconTile(s, x + 0.25, y + 0.25, 0.6, col.c, col.Icon);
      s.addText(col.t, {
        x: x + 1.0, y: y + 0.35, w: w - 1.15, h: 0.4,
        fontFace: HEADER_FONT, fontSize: 18, bold: true, color: C.text, margin: 0,
      });

      // bullet items
      const bullets = col.items.map((t, k) => ({
        text: t,
        options: { bullet: { code: "25CF" }, breakLine: k < col.items.length - 1, color: C.text, fontSize: 12 },
      }));
      s.addText(bullets, {
        x: x + 0.3, y: y + 1.05, w: w - 0.5, h: h - 1.2,
        fontFace: BODY_FONT, paraSpaceAfter: 6, margin: 0,
      });
    });

    footer(s, 4, TOTAL);

    s.addNotes(
      "Three layers. Frontend is Vue 3 with the Composition API, Vite as the build tool, Tailwind plus DaisyUI " +
      "for styling, Chart.js for visualization, and Stripe.js Elements for the payment form. " +
      "Backend is Python 3 and Django 6 with Django REST Framework, PostgreSQL as the database, " +
      "django-allauth for the Google OAuth flow, and the official Stripe SDK. " +
      "Data layer uses Pandas for processing, Mlxtend for Apriori association rules, " +
      "and scikit-learn with Matplotlib for the decision tree."
    );
  }

  // ─── SLIDE 5 — Architecture ───────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "How the pieces talk to each other", "04 · ARCHITECTURE");

    // Three primary boxes in a row, with arrows
    const boxY = 1.7, boxH = 1.5;

    function archBox(x, w, color, Icon, top, bottom) {
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y: boxY, w, h: boxH,
        fill: { color: C.card }, line: { color, width: 1.5 },
        rectRadius: 0.1,
      });
      iconTile(s, x + 0.25, boxY + 0.3, 0.5, color, Icon);
      s.addText(top, {
        x: x + 0.9, y: boxY + 0.32, w: w - 1.05, h: 0.32,
        fontFace: HEADER_FONT, fontSize: 13, bold: true, color: C.text, margin: 0,
      });
      s.addText(bottom, {
        x: x + 0.9, y: boxY + 0.62, w: w - 1.05, h: 0.3,
        fontFace: BODY_FONT, fontSize: 10, color: C.muted, margin: 0,
      });
    }
    function archDetail(x, w, lines) {
      s.addText(lines, {
        x: x + 0.25, y: boxY + 0.95, w: w - 0.5, h: 0.55,
        fontFace: BODY_FONT, fontSize: 10, color: C.muted, margin: 0,
      });
    }

    // Frontend
    archBox(0.55, 2.55, C.primary, I.vue,
      "Vue 3 + Vite SPA", "localhost:5173");
    archDetail(0.55, 2.55, "Routing · Stripe.js · Drag-drop calendar · Chart.js");

    // Backend
    archBox(3.7, 2.6, C.secondary, I.server,
      "Django + DRF API", "127.0.0.1:8000");
    archDetail(3.7, 2.6, "Token auth · ML endpoints · Swagger · Allauth");

    // Database
    archBox(6.95, 2.55, C.green, I.db,
      "PostgreSQL", "garaz_db");
    archDetail(6.95, 2.55, "Garages · reservations · payments · users");

    // Arrows between
    [3.10, 6.30].forEach((x) => {
      s.addImage({ data: I.arrow, x, y: boxY + 0.55, w: 0.4, h: 0.4 });
    });

    // External services row
    const extY = 3.85;
    const ext = [
      { c: C.primary,   Icon: I.pay,    t: "Stripe", d: "Test-mode payments + refunds" },
      { c: C.secondary, Icon: I.mail,   t: "Gmail SMTP", d: "Verification + change emails" },
      { c: C.green,     Icon: I.google, t: "Google OAuth", d: "One-click sign in" },
      { c: C.amber,     Icon: I.lock,   t: ".env.local", d: "Secrets via python-dotenv" },
    ];
    ext.forEach((e, i) => {
      const x = 0.55 + i * 2.3;
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y: extY, w: 2.15, h: 0.9,
        fill: { color: C.card }, line: { color: C.border, width: 0.75 },
        rectRadius: 0.08,
      });
      iconTile(s, x + 0.18, extY + 0.2, 0.5, e.c, e.Icon);
      s.addText(e.t, {
        x: x + 0.78, y: extY + 0.18, w: 1.35, h: 0.32,
        fontFace: HEADER_FONT, fontSize: 12, bold: true, color: C.text, margin: 0,
      });
      s.addText(e.d, {
        x: x + 0.78, y: extY + 0.5, w: 1.35, h: 0.32,
        fontFace: BODY_FONT, fontSize: 9, color: C.muted, margin: 0,
      });
    });

    footer(s, 5, TOTAL);

    s.addNotes(
      "Here's how the pieces fit together. The Vue single-page app on port 5173 talks to the Django REST API " +
      "on port 8000 over HTTP, using token authentication. Django persists everything to PostgreSQL. " +
      "Three external integrations: Stripe in test mode for payments, Gmail SMTP for verification emails, " +
      "and Google OAuth via allauth for one-click sign-in. All secrets — API keys, the database password, " +
      "the email password — live in a gitignored .env.local file that python-dotenv loads at startup. " +
      "Nothing sensitive is ever in the repo."
    );
  }

  // ─── SLIDE 6 — User Journey ──────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "From discovery to keys in hand", "05 · USER JOURNEY");

    const steps = [
      { c: C.primary,   Icon: I.search, t: "Discover", d: "Browse cards. Filter by city, price, equipment." },
      { c: C.secondary, Icon: I.cal,    t: "Reserve",  d: "Pick days on calendar, drag hours on timeline." },
      { c: C.pink,      Icon: I.pay,    t: "Pay",      d: "Stripe Elements. 15 min to complete." },
      { c: C.green,     Icon: I.key,    t: "Use",      d: "6-digit PIN reveals in the dashboard." },
    ];

    const cardW = 2.1, cardH = 2.7, baseY = 1.6;
    steps.forEach((st, i) => {
      const x = 0.55 + i * 2.35;

      // Step number badge above card
      s.addShape(pptx.shapes.OVAL, {
        x: x + cardW / 2 - 0.18, y: baseY - 0.3, w: 0.36, h: 0.36,
        fill: { color: C.dark }, line: { color: C.dark, width: 0 },
      });
      s.addText(String(i + 1), {
        x: x + cardW / 2 - 0.18, y: baseY - 0.3, w: 0.36, h: 0.36,
        fontFace: HEADER_FONT, fontSize: 14, bold: true, color: "FFFFFF",
        align: "center", valign: "middle", margin: 0,
      });

      // Card
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y: baseY, w: cardW, h: cardH,
        fill: { color: C.card },
        line: { color: C.border, width: 0.75 },
        rectRadius: 0.1,
        shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 12, offset: 3, angle: 90 },
      });
      iconTile(s, x + cardW / 2 - 0.4, baseY + 0.35, 0.8, st.c, st.Icon);
      s.addText(st.t, {
        x, y: baseY + 1.3, w: cardW, h: 0.4,
        fontFace: HEADER_FONT, fontSize: 16, bold: true, color: C.text,
        align: "center", margin: 0,
      });
      s.addText(st.d, {
        x: x + 0.15, y: baseY + 1.7, w: cardW - 0.3, h: 0.9,
        fontFace: BODY_FONT, fontSize: 11, color: C.muted,
        align: "center", margin: 0,
      });

      // connecting arrow
      if (i < steps.length - 1) {
        s.addImage({
          data: I.arrow,
          x: x + cardW + 0.05, y: baseY + cardH / 2 - 0.15,
          w: 0.25, h: 0.25,
        });
      }
    });

    s.addText("Time-to-first-reservation under 60 seconds.", {
      x: 0.55, y: 4.7, w: 8.95, h: 0.35,
      fontFace: BODY_FONT, fontSize: 12, color: C.muted, italic: true,
      align: "center", margin: 0,
    });

    footer(s, 6, TOTAL);

    s.addNotes(
      "The user journey is four steps and a new user can complete it in under a minute. " +
      "Discover the garage on the offer page. Reserve a time on the booking screen. Pay through Stripe Elements " +
      "with a 15-minute window. Then use the access code that appears in the dashboard. " +
      "Let us zoom in on each step."
    );
  }

  // ─── SLIDE 7 — Reservation Calendar ──────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Drag-and-drop calendar + hourly timeline", "06 · BOOKING ENGINE");

    // Left bullets
    const points = [
      { Icon: I.cal,    t: "Drag-select multiple days on the month grid." },
      { Icon: I.bolt,   t: "Hourly timeline lets you drag a range within a single day." },
      { Icon: I.shieldDk, t: "Server validates: no conflicts, no past dates, max-duration rule." },
      { Icon: I.cogs,   t: "Pricing auto-switches: per-hour for short slots, per-day discount for 24h+." },
    ];
    points.forEach((p, i) => {
      const y = 1.4 + i * 0.85;
      iconTile(s, 0.55, y, 0.5, C.primary, p.Icon);
      s.addText(p.t, {
        x: 1.25, y: y + 0.07, w: 4.0, h: 0.55,
        fontFace: BODY_FONT, fontSize: 12, color: C.text, margin: 0,
      });
    });

    // Right: stylised timeline mock
    const tx = 5.5, ty = 1.4, tw = 4.0, th = 3.4;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: tx, y: ty, w: tw, h: th,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 },
      rectRadius: 0.1,
    });
    s.addText("Wed · 24 hours", {
      x: tx + 0.2, y: ty + 0.15, w: tw - 0.4, h: 0.3,
      fontFace: HEADER_FONT, fontSize: 12, bold: true, color: C.text, margin: 0,
    });

    // 24 timeline cells
    const cellW = (tw - 0.4) / 24;
    const cellY = ty + 0.55, cellH = 0.5;
    for (let h = 0; h < 24; h++) {
      let color = C.border;
      if (h < 8) color = "CBD5E1"; // past
      else if (h >= 14 && h < 18) color = C.primary; // selected
      else if (h === 11 || h === 12) color = "EF4444"; // busy
      s.addShape(pptx.shapes.RECTANGLE, {
        x: tx + 0.2 + h * cellW, y: cellY, w: cellW - 0.02, h: cellH,
        fill: { color }, line: { color, width: 0 },
      });
    }
    s.addText("0", { x: tx + 0.2, y: cellY + cellH + 0.02, w: 0.4, h: 0.2, fontFace: BODY_FONT, fontSize: 8, color: C.muted, margin: 0 });
    s.addText("12", { x: tx + 0.2 + 12 * cellW - 0.1, y: cellY + cellH + 0.02, w: 0.4, h: 0.2, fontFace: BODY_FONT, fontSize: 8, color: C.muted, margin: 0 });
    s.addText("24", { x: tx + tw - 0.5, y: cellY + cellH + 0.02, w: 0.4, h: 0.2, fontFace: BODY_FONT, fontSize: 8, color: C.muted, align: "right", margin: 0 });

    // Legend
    const legend = [
      { color: "CBD5E1", label: "Past" },
      { color: "EF4444", label: "Busy" },
      { color: C.primary, label: "Your selection" },
      { color: C.border, label: "Free" },
    ];
    legend.forEach((l, i) => {
      const ly = ty + 1.55 + i * 0.4;
      s.addShape(pptx.shapes.OVAL, {
        x: tx + 0.25, y: ly + 0.05, w: 0.18, h: 0.18,
        fill: { color: l.color }, line: { color: l.color, width: 0 },
      });
      s.addText(l.label, {
        x: tx + 0.5, y: ly, w: 2.5, h: 0.28,
        fontFace: BODY_FONT, fontSize: 11, color: C.text, margin: 0,
      });
    });

    // To pay panel
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: tx + 2.3, y: ty + 2.1, w: 1.5, h: 1.05,
      fill: { color: C.dark }, line: { color: C.dark, width: 0 }, rectRadius: 0.08,
    });
    s.addText("TO PAY", {
      x: tx + 2.4, y: ty + 2.18, w: 1.3, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.mutedInv, charSpacing: 4, margin: 0,
    });
    s.addText("€118", {
      x: tx + 2.4, y: ty + 2.42, w: 1.3, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 22, bold: true, color: "FFFFFF", margin: 0,
    });
    s.addText("4 h × €30/h", {
      x: tx + 2.4, y: ty + 2.92, w: 1.3, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, margin: 0,
    });

    footer(s, 7, TOTAL);

    s.addNotes(
      "The booking screen has two interactions. Drag across the month grid to pick a multi-day range, " +
      "or pick a single day and drag on the hourly timeline to choose an exact time window. " +
      "The server validates everything: no conflicts with existing reservations, no past dates, " +
      "enforces the maximum-duration rule from the system config. Pricing switches automatically — " +
      "per hour for short slots, per-day discounted rate for bookings of 24 hours or more. " +
      "On the right is a mock of the timeline: past hours are grey, two busy hours are red, " +
      "and the selected window is in indigo."
    );
  }

  // ─── SLIDE 8 — Stripe Payments ───────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Stripe Elements + a 15-minute window", "07 · PAYMENTS");

    // Left description list
    const items = [
      { t: "Test-mode integration",
        d: "Stripe.js Elements on the frontend; PaymentIntent on the backend.", c: C.primary, Icon: I.pay },
      { t: "15-minute hold",
        d: "Pending reservations auto-cancel if not paid in time.", c: C.amber, Icon: I.bolt },
      { t: "Refund logic",
        d: "Cancel > 24h before start → automatic refund. Closer → no refund.", c: C.green, Icon: I.check },
      { t: "Reservation extension",
        d: "Extend by hours or a day with a follow-up Stripe payment.", c: C.secondary, Icon: I.cogs },
    ];
    items.forEach((it, i) => {
      const y = 1.4 + i * 0.85;
      iconTile(s, 0.55, y, 0.55, it.c, it.Icon);
      s.addText(it.t, {
        x: 1.3, y, w: 4.0, h: 0.35,
        fontFace: HEADER_FONT, fontSize: 13, bold: true, color: C.text, margin: 0,
      });
      s.addText(it.d, {
        x: 1.3, y: y + 0.36, w: 4.0, h: 0.4,
        fontFace: BODY_FONT, fontSize: 11, color: C.muted, margin: 0,
      });
    });

    // Right: stylised "card" panel
    const px = 5.7, py = 1.4, pw = 3.85, ph = 3.5;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: px, y: py, w: pw, h: ph,
      fill: { color: C.dark }, line: { color: C.dark, width: 0 }, rectRadius: 0.12,
    });
    s.addText("RESERVATION  #523", {
      x: px + 0.3, y: py + 0.25, w: pw - 0.6, h: 0.28,
      fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.mutedInv, charSpacing: 4, margin: 0,
    });
    s.addText("€59.00", {
      x: px + 0.3, y: py + 0.55, w: pw - 0.6, h: 0.6,
      fontFace: HEADER_FONT, fontSize: 30, bold: true, color: "FFFFFF", margin: 0,
    });

    // Mock card number row
    s.addText("CARD NUMBER", {
      x: px + 0.3, y: py + 1.3, w: pw - 0.6, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, charSpacing: 3, margin: 0,
    });
    s.addText("4242 4242 4242 4242", {
      x: px + 0.3, y: py + 1.55, w: pw - 0.6, h: 0.35,
      fontFace: HEADER_FONT, fontSize: 16, bold: true, color: "FFFFFF", margin: 0,
    });
    // Expiry + CVC
    s.addText("EXPIRY", {
      x: px + 0.3, y: py + 2.05, w: 1.4, h: 0.2,
      fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, charSpacing: 3, margin: 0,
    });
    s.addText("12/27", {
      x: px + 0.3, y: py + 2.25, w: 1.4, h: 0.35,
      fontFace: HEADER_FONT, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
    });
    s.addText("CVC", {
      x: px + 1.8, y: py + 2.05, w: 1.4, h: 0.2,
      fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, charSpacing: 3, margin: 0,
    });
    s.addText("123", {
      x: px + 1.8, y: py + 2.25, w: 1.4, h: 0.35,
      fontFace: HEADER_FONT, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
    });

    // Pay button
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: px + 0.3, y: py + 2.75, w: pw - 0.6, h: 0.5,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 }, rectRadius: 0.08,
    });
    s.addText("Pay €59", {
      x: px + 0.3, y: py + 2.75, w: pw - 0.6, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 13, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0,
    });

    footer(s, 8, TOTAL);

    s.addNotes(
      "Payments use Stripe Elements. The frontend embeds Stripe's hosted credit-card form so card details " +
      "never touch our server. The backend creates a PaymentIntent and returns the client secret. " +
      "There's a 15-minute hold — if the user doesn't complete payment in time, the reservation auto-cancels " +
      "and frees the slot. Cancellations more than 24 hours before the start get a full automatic refund " +
      "through the Stripe Refund API. Users can also extend a confirmed reservation, with a follow-up Stripe " +
      "payment for the additional hours. For the demo we'll use Stripe's test card: 4242 4242 4242 4242."
    );
  }

  // ─── SLIDE 9 — Auth & Accounts ──────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Email verification, Google OAuth, profile self-service", "08 · ACCOUNTS & AUTH");

    const cards = [
      { c: C.primary,   Icon: I.mail,
        t: "Sign up with email",
        d: "Account stays inactive until the verification link is clicked. In DEBUG mode the link is also printed to the Django console." },
      { c: C.secondary, Icon: I.google,
        t: "Sign in with Google",
        d: "Django-allauth handles OAuth. social_login_success bridges Django session to a DRF token, frontend lands on /auth-callback." },
      { c: C.green,     Icon: I.shieldDk,
        t: "Roles & guards",
        d: "client / admin roles. UserSerializer ignores role updates on the profile endpoint to prevent privilege escalation." },
      { c: C.amber,     Icon: I.cogs,
        t: "Self-service",
        d: "Change email with re-verification, change password, delete account (password-confirmed)." },
    ];
    cards.forEach((c, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const x = 0.55 + col * 4.55;
      const y = 1.4 + row * 1.8;
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y, w: 4.4, h: 1.6,
        fill: { color: C.card }, line: { color: C.border, width: 0.75 },
        rectRadius: 0.1,
        shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 12, offset: 3, angle: 90 },
      });
      iconTile(s, x + 0.25, y + 0.3, 0.55, c.c, c.Icon);
      s.addText(c.t, {
        x: x + 1.0, y: y + 0.3, w: 3.2, h: 0.35,
        fontFace: HEADER_FONT, fontSize: 14, bold: true, color: C.text, margin: 0,
      });
      s.addText(c.d, {
        x: x + 1.0, y: y + 0.68, w: 3.2, h: 0.85,
        fontFace: BODY_FONT, fontSize: 11, color: C.muted, margin: 0,
      });
    });

    footer(s, 9, TOTAL);

    s.addNotes(
      "Two ways to sign in. Email plus password with a verification link, or Google OAuth via allauth. " +
      "The user model has roles — client and admin. One subtle security touch we added: when a user PATCHes their " +
      "own profile, the serializer explicitly ignores the role field, so a client can't promote themselves " +
      "to admin by hand-crafting a request. There's a unit test that asserts this. Self-service: users can " +
      "change their email — which triggers a re-verification — change their password, or delete their account " +
      "with password confirmation."
    );
  }

  // ─── SLIDE 10 — Client Dashboard ────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "One place for everything the client owns", "09 · CLIENT DASHBOARD");

    // Left: bullet feature list with mini icons
    const feats = [
      { Icon: I.list,   t: "Reservations",       d: "Upcoming / history tabs · filter by status." },
      { Icon: I.bolt,   t: "Payment countdown",  d: "Floating timer for the 15-min payment window." },
      { Icon: I.key,    t: "Access code",        d: "6-digit PIN revealed after payment confirms." },
      { Icon: I.cogs,   t: "Extend reservation", d: "Add hours or a day, pay the difference via Stripe." },
      { Icon: I.shield, t: "Profile & security", d: "Email change with re-verification, password change, account delete." },
      { Icon: I.chart,  t: "Wallet view",        d: "Payment history with totals." },
    ];
    feats.forEach((f, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.55 + col * 4.55;
      const y = 1.3 + row * 1.18;
      iconTile(s, x, y, 0.5, C.primary, f.Icon);
      s.addText(f.t, {
        x: x + 0.7, y, w: 3.7, h: 0.32,
        fontFace: HEADER_FONT, fontSize: 13, bold: true, color: C.text, margin: 0,
      });
      s.addText(f.d, {
        x: x + 0.7, y: y + 0.33, w: 3.7, h: 0.65,
        fontFace: BODY_FONT, fontSize: 11, color: C.muted, margin: 0,
      });
    });

    footer(s, 10, TOTAL);

    s.addNotes(
      "Each client has a personal dashboard. They see their reservations split into upcoming and history, " +
      "can filter by status, see a live countdown timer for any pending payment, reveal the access PIN " +
      "after the booking is confirmed, extend an active reservation by hours or by a full day, edit their " +
      "profile with required password confirmation, and see all their payments in a wallet view."
    );
  }

  // ─── SLIDE 11 — Admin Panel ─────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Full operator control + an availability calendar", "10 · ADMIN PANEL");

    const cards = [
      { c: C.primary,   Icon: I.warehouse, t: "Garages CRUD",
        d: "Name, address, hourly/daily price, equipment, photo, active flag." },
      { c: C.secondary, Icon: I.users,     t: "Users",
        d: "Activate / block, edit, hand-create with a chosen role." },
      { c: C.pink,      Icon: I.list,      t: "Reservations",
        d: "Change status, emergency cancel with reason, mark overstays." },
      { c: C.green,     Icon: I.cal,       t: "Calendar view",
        d: "Month overview per garage: free / partial / full color coding." },
      { c: C.amber,     Icon: I.cogs,      t: "System config",
        d: "Refund hours, max active reservations, max duration, base prices." },
      { c: C.cyan,      Icon: I.tools,     t: "Equipment catalog",
        d: "Add tools that garages can be tagged with." },
    ];
    const cardW = 2.95, cardH = 1.55;
    cards.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.55 + col * 3.05;
      const y = 1.3 + row * 1.7;
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y, w: cardW, h: cardH,
        fill: { color: C.card }, line: { color: C.border, width: 0.75 },
        rectRadius: 0.1,
        shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 12, offset: 3, angle: 90 },
      });
      iconTile(s, x + 0.2, y + 0.2, 0.5, c.c, c.Icon);
      s.addText(c.t, {
        x: x + 0.85, y: y + 0.2, w: cardW - 1.0, h: 0.32,
        fontFace: HEADER_FONT, fontSize: 13, bold: true, color: C.text, margin: 0,
      });
      s.addText(c.d, {
        x: x + 0.2, y: y + 0.78, w: cardW - 0.4, h: 0.7,
        fontFace: BODY_FONT, fontSize: 11, color: C.muted, margin: 0,
      });
    });

    footer(s, 11, TOTAL);

    s.addNotes(
      "On the admin side there is full CRUD over six resources: garages, users, reservations, equipment, " +
      "payments, and system configuration. The standout feature is the calendar view that shows a whole month " +
      "per garage with color-coded availability — green free, light red partial, dark red fully booked. " +
      "Admins can also emergency-cancel a reservation with a reason that the client sees as a notification, " +
      "and mark customers who overstayed, which prevents them from booking again until cleared."
    );
  }

  // ─── SLIDE 12 — Analytics Dashboard ─────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Revenue, popularity, and an occupancy heatmap", "11 · ANALYTICS");

    // Left: title + bullets
    const points = [
      "Filter by date range and equipment.",
      "Revenue line chart over time.",
      "Top-10 popularity ranking (doughnut).",
      "Weekday × hour heatmap shows when bays get hot.",
    ];
    points.forEach((p, i) => {
      s.addText("•  " + p, {
        x: 0.55, y: 1.45 + i * 0.5, w: 4.3, h: 0.4,
        fontFace: BODY_FONT, fontSize: 12, color: C.text, margin: 0,
      });
    });

    // Right: native chart — Revenue line
    s.addChart(pptx.charts.LINE,
      [{
        name: "Revenue (EUR)",
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        values: [190, 256, 312, 347, 391, 500, 461],
      }],
      {
        x: 5.0, y: 1.3, w: 4.5, h: 2.1,
        chartColors: [C.primary],
        lineSize: 3, lineSmooth: true,
        showTitle: true, title: "Revenue this week", titleFontSize: 12,
        titleColor: C.text, titleFontFace: HEADER_FONT,
        catAxisLabelColor: C.muted, valAxisLabelColor: C.muted,
        catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
        valGridLine: { color: C.border, size: 0.5 },
        catGridLine: { style: "none" },
        showLegend: false,
        chartArea: { fill: { color: C.card } },
      }
    );

    // Heatmap mock with shapes (simulates the day×hour grid)
    const hx = 5.0, hy = 3.55, hRowH = 0.18, hColW = 0.18;
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    const intensity = [
      [0,0,0,0,0,0,1,1,2,3,3,3,3,3,3,2,2,1,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,1,2,3,3,3,3,3,3,3,2,2,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,2,2,3,3,3,3,3,3,3,3,2,1,0,0,0,0,0],
      [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,2,2,1,0,0,0,0],
      [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,3,3,2,2,1,0,0,0],
      [0,0,0,0,0,0,2,3,3,3,3,3,3,3,3,3,3,3,3,2,1,0,0,0],
      [0,0,0,0,0,0,1,2,3,3,3,3,3,3,3,3,2,2,1,0,0,0,0,0],
    ];
    const palette = ["F1F5F9", "C7D2FE", "818CF8", C.primary];
    s.addText("Occupancy heatmap (day × hour)", {
      x: hx, y: hy - 0.3, w: 4.5, h: 0.25,
      fontFace: HEADER_FONT, fontSize: 11, bold: true, color: C.text, margin: 0,
    });
    days.forEach((d, r) => {
      s.addText(d, {
        x: hx - 0.05, y: hy + r * hRowH - 0.02, w: 0.2, h: hRowH,
        fontFace: BODY_FONT, fontSize: 8, color: C.muted,
        align: "right", margin: 0,
      });
      for (let c = 0; c < 24; c++) {
        s.addShape(pptx.shapes.RECTANGLE, {
          x: hx + 0.18 + c * hColW,
          y: hy + r * hRowH,
          w: hColW - 0.01,
          h: hRowH - 0.02,
          fill: { color: palette[intensity[r][c]] },
          line: { color: palette[intensity[r][c]], width: 0 },
        });
      }
    });

    footer(s, 12, TOTAL);

    s.addNotes(
      "The analytics page is a real business-intelligence dashboard. Revenue over time as a line chart, " +
      "top-10 popularity ranking as a doughnut chart, and an occupancy heatmap broken down by weekday and hour. " +
      "All filterable by date range and by garage equipment. The data here comes from the seeded database — " +
      "about 1,500 historical reservations generated with intentional patterns the ML modules can then detect."
    );
  }

  // ─── SLIDE 13 — ML Apriori ──────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Apriori finds the patterns hiding in 1,500+ reservations", "12 · MACHINE LEARNING (1/2)");

    // Left: how it works
    iconTile(s, 0.55, 1.35, 0.6, C.primary, I.brain);
    s.addText("Association rule mining (mlxtend)", {
      x: 1.3, y: 1.4, w: 4.5, h: 0.4,
      fontFace: HEADER_FONT, fontSize: 16, bold: true, color: C.text, margin: 0,
    });
    s.addText("Each reservation is encoded as a transaction of features (equipment, weekday, duration tier). Apriori discovers high-confidence rules.", {
      x: 0.55, y: 2.1, w: 5.0, h: 1.1,
      fontFace: BODY_FONT, fontSize: 12, color: C.muted, margin: 0,
    });

    const steps = [
      "1. Pull confirmed/completed reservations",
      "2. Encode features into a binary matrix",
      "3. Apriori → frequent itemsets",
      "4. Generate rules + confidence + lift",
      "5. Sort, paginate, surface in UI",
    ];
    steps.forEach((t, i) => {
      s.addText(t, {
        x: 0.55, y: 3.2 + i * 0.32, w: 5.0, h: 0.3,
        fontFace: BODY_FONT, fontSize: 11, color: C.text, margin: 0,
      });
    });

    // Right: example rule card
    const rx = 5.85, ry = 1.35, rw = 3.6, rh = 3.5;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: rx, y: ry, w: rw, h: rh,
      fill: { color: C.dark }, line: { color: C.dark, width: 0 }, rectRadius: 0.12,
    });
    s.addText("EXAMPLE RULE", {
      x: rx + 0.25, y: ry + 0.2, w: rw - 0.5, h: 0.3,
      fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.mutedInv, charSpacing: 4, margin: 0,
    });
    s.addText("Two-post Lift", {
      x: rx + 0.25, y: ry + 0.55, w: rw - 0.5, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 20, bold: true, color: "FFFFFF", margin: 0,
    });
    s.addText("➔", {
      x: rx + 0.25, y: ry + 1.05, w: rw - 0.5, h: 0.4,
      fontFace: HEADER_FONT, fontSize: 22, color: C.mutedInv, margin: 0,
    });
    s.addText("Reservation over 4 h", {
      x: rx + 0.25, y: ry + 1.45, w: rw - 0.5, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 18, bold: true, color: "FFFFFF", margin: 0,
    });

    // metrics row
    s.addShape(pptx.shapes.RECTANGLE, {
      x: rx + 0.25, y: ry + 2.15, w: rw - 0.5, h: 0.02,
      fill: { color: C.borderDk }, line: { color: C.borderDk, width: 0 },
    });

    s.addText("CONFIDENCE", {
      x: rx + 0.25, y: ry + 2.3, w: 1.6, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, charSpacing: 3, margin: 0,
    });
    s.addText("80%", {
      x: rx + 0.25, y: ry + 2.5, w: 1.6, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 26, bold: true, color: C.green, margin: 0,
    });
    s.addText("LIFT", {
      x: rx + 1.95, y: ry + 2.3, w: 1.4, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, color: C.mutedInv, charSpacing: 3, margin: 0,
    });
    s.addText("2.4", {
      x: rx + 1.95, y: ry + 2.5, w: 1.4, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 26, bold: true, color: "FFFFFF", margin: 0,
    });
    s.addText("“When a garage has a Two-post Lift, there is an 80% chance the reservation runs longer than 4 h.”", {
      x: rx + 0.25, y: ry + 3.0, w: rw - 0.5, h: 0.45,
      fontFace: BODY_FONT, fontSize: 10, color: C.mutedInv, italic: true, margin: 0,
    });

    footer(s, 13, TOTAL);

    s.addNotes(
      "First machine learning feature: association rule mining with the Apriori algorithm, implemented via Mlxtend. " +
      "The system encodes each historical reservation as a transaction of features — what equipment did the garage " +
      "have, was it a weekend, was the booking longer than four hours. Apriori then finds frequent itemsets and " +
      "generates rules with confidence and lift scores. The example shown is a real rule from the seeded data: " +
      "when a garage has a two-post lift, there's an 80% chance the reservation runs longer than four hours, " +
      "with a lift of 2.4 — meaning that's 2.4 times more likely than the base rate. Rules are sorted, paginated, " +
      "and rendered in the UI."
    );
  }

  // ─── SLIDE 14 — ML Decision Tree ────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Decision Tree predicts cancellation vs success", "13 · MACHINE LEARNING (2/2)");

    // Left: what it does
    iconTile(s, 0.55, 1.35, 0.6, C.secondary, I.diagram);
    s.addText("Churn prediction (scikit-learn)", {
      x: 1.3, y: 1.4, w: 4.5, h: 0.4,
      fontFace: HEADER_FONT, fontSize: 16, bold: true, color: C.text, margin: 0,
    });
    s.addText("Classifier learns from confirmed vs cancelled reservations. Matplotlib renders the tree to PNG and the API returns a base64 data-URI for direct display.", {
      x: 0.55, y: 2.1, w: 5.0, h: 1.3,
      fontFace: BODY_FONT, fontSize: 12, color: C.muted, margin: 0,
    });

    s.addText("FEATURES", {
      x: 0.55, y: 3.45, w: 4.5, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.muted, charSpacing: 4, margin: 0,
    });
    const feats = ["Day of week", "Start hour", "Has: Two-post Lift", "Has: Service Pit", "Has: MIG/MAG Welder", "..."];
    feats.forEach((f, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.55 + col * 1.55, y: 3.75 + row * 0.4, w: 1.45, h: 0.3,
        fill: { color: "EEF2FF" }, line: { color: "C7D2FE", width: 0.5 }, rectRadius: 0.04,
      });
      s.addText(f, {
        x: 0.55 + col * 1.55, y: 3.75 + row * 0.4, w: 1.45, h: 0.3,
        fontFace: BODY_FONT, fontSize: 9, color: C.primary,
        align: "center", valign: "middle", margin: 0,
      });
    });

    // Right: stylised tree mock
    const tx = 5.85, ty = 1.4, tw = 3.6, th = 3.45;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: tx, y: ty, w: tw, h: th,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 }, rectRadius: 0.1,
    });

    function node(x, y, w, h, fill, text) {
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y, w, h,
        fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.06,
      });
      s.addText(text, {
        x, y, w, h,
        fontFace: BODY_FONT, fontSize: 9, color: "FFFFFF", bold: true,
        align: "center", valign: "middle", margin: 0,
      });
    }
    function edge(x1, y1, x2, y2) {
      // PowerPoint requires non-negative width/height. Normalize and use flipH
      // when the line goes from top-right to bottom-left.
      const x = Math.min(x1, x2);
      const y = Math.min(y1, y2);
      const w = Math.max(0.01, Math.abs(x2 - x1));
      const h = Math.max(0.01, Math.abs(y2 - y1));
      const flipH = (x1 > x2 && y1 < y2) || (x1 < x2 && y1 > y2);
      s.addShape(pptx.shapes.LINE, {
        x, y, w, h, flipH,
        line: { color: C.muted, width: 1 },
      });
    }

    // Root
    node(tx + 1.05, ty + 0.3, 1.5, 0.45, C.dark, "Hour ≤ 17 ?");
    edge(tx + 1.4, ty + 0.75, tx + 0.6, ty + 1.3);
    edge(tx + 2.2, ty + 0.75, tx + 3.0, ty + 1.3);
    // L2
    node(tx + 0.15, ty + 1.3, 1.4, 0.45, C.primary, "Has lift ?");
    node(tx + 2.05, ty + 1.3, 1.4, 0.45, C.primary, "Weekend ?");
    edge(tx + 0.6, ty + 1.75, tx + 0.4, ty + 2.3);
    edge(tx + 1.15, ty + 1.75, tx + 1.45, ty + 2.3);
    edge(tx + 2.5, ty + 1.75, tx + 2.2, ty + 2.3);
    edge(tx + 3.0, ty + 1.75, tx + 3.2, ty + 2.3);
    // Leaves
    node(tx + 0.1, ty + 2.3, 0.85, 0.4, C.green,  "SUCCESS");
    node(tx + 1.15, ty + 2.3, 0.85, 0.4, "EF4444", "CANCEL");
    node(tx + 1.95, ty + 2.3, 0.85, 0.4, C.green,  "SUCCESS");
    node(tx + 3.0, ty + 2.3, 0.5, 0.4, "EF4444", "X");

    s.addText("Plus: dataset is exportable to CSV (Export Data button).", {
      x: tx + 0.2, y: ty + 2.85, w: tw - 0.4, h: 0.4,
      fontFace: BODY_FONT, fontSize: 10, color: C.muted, italic: true, margin: 0,
    });

    footer(s, 14, TOTAL);

    s.addNotes(
      "Second machine-learning feature: a decision tree for churn prediction, using scikit-learn's " +
      "DecisionTreeClassifier. The classifier learns from confirmed versus cancelled reservations, with features " +
      "like day of the week, start hour, and which equipment is present. Matplotlib renders the trained tree " +
      "to a PNG, and the API returns it as a base64 data URI so the frontend can embed it directly without " +
      "needing a separate image endpoint. You can also export the training dataset to CSV from the same screen."
    );
  }

  // ─── SLIDE 15 — Sandbox / CSV ───────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Re-run ML on any dataset without touching the database", "14 · SANDBOX MODE");

    // Left: explanation
    iconTile(s, 0.55, 1.35, 0.6, C.amber, I.csv);
    s.addText("CSV simulation", {
      x: 1.3, y: 1.4, w: 4.5, h: 0.4,
      fontFace: HEADER_FONT, fontSize: 18, bold: true, color: C.text, margin: 0,
    });
    s.addText("Upload an external reservation history (or your own export). The same ML pipeline runs in-memory; the database stays untouched.", {
      x: 0.55, y: 2.1, w: 4.6, h: 1.3,
      fontFace: BODY_FONT, fontSize: 12, color: C.muted, margin: 0,
    });

    s.addText("Use cases", {
      x: 0.55, y: 3.4, w: 4.6, h: 0.3,
      fontFace: BODY_FONT, fontSize: 9, bold: true, color: C.muted, charSpacing: 4, margin: 0,
    });
    const uses = [
      "Demo with sample data without polluting production",
      "Compare two months by uploading each one",
      "Try ML on a synthetic dataset",
    ];
    uses.forEach((u, i) => {
      s.addText("•  " + u, {
        x: 0.55, y: 3.75 + i * 0.35, w: 4.6, h: 0.3,
        fontFace: BODY_FONT, fontSize: 11, color: C.text, margin: 0,
      });
    });

    // Right: "simulation banner"
    const bx = 5.5, by = 1.35, bw = 4.0, bh = 3.5;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: bx, y: by, w: bw, h: bh,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 }, rectRadius: 0.12,
    });
    // Amber warning bar
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: bx + 0.2, y: by + 0.2, w: bw - 0.4, h: 0.55,
      fill: { color: "FEF3C7" }, line: { color: "FCD34D", width: 0.75 }, rectRadius: 0.06,
    });
    s.addText("⚠  Preview / Simulation Mode", {
      x: bx + 0.35, y: by + 0.2, w: bw - 0.7, h: 0.55,
      fontFace: HEADER_FONT, fontSize: 11, bold: true, color: "92400E",
      valign: "middle", margin: 0,
    });

    // Faux file row
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: bx + 0.2, y: by + 1.05, w: bw - 0.4, h: 0.45,
      fill: { color: C.bg }, line: { color: C.border, width: 0.5 }, rectRadius: 0.05,
    });
    iconTile(s, bx + 0.3, by + 1.1, 0.35, C.amber, I.csv);
    s.addText("reservations_2025_10.csv  ·  342 rows", {
      x: bx + 0.75, y: by + 1.05, w: bw - 1.05, h: 0.45,
      fontFace: BODY_FONT, fontSize: 11, color: C.text,
      valign: "middle", margin: 0,
    });

    // Result cards
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: bx + 0.2, y: by + 1.65, w: 1.7, h: 1.0,
      fill: { color: "EEF2FF" }, line: { color: "C7D2FE", width: 0.5 }, rectRadius: 0.08,
    });
    s.addText("REVENUE", {
      x: bx + 0.3, y: by + 1.7, w: 1.5, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, color: C.primary, charSpacing: 3, bold: true, margin: 0,
    });
    s.addText("€11,330", {
      x: bx + 0.3, y: by + 1.95, w: 1.5, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 18, bold: true, color: C.primary, margin: 0,
    });
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: bx + 2.0, y: by + 1.65, w: 1.7, h: 1.0,
      fill: { color: "ECFDF5" }, line: { color: "A7F3D0", width: 0.5 }, rectRadius: 0.08,
    });
    s.addText("SUCCESS RATE", {
      x: bx + 2.1, y: by + 1.7, w: 1.5, h: 0.25,
      fontFace: BODY_FONT, fontSize: 9, color: "047857", charSpacing: 3, bold: true, margin: 0,
    });
    s.addText("82%", {
      x: bx + 2.1, y: by + 1.95, w: 1.5, h: 0.5,
      fontFace: HEADER_FONT, fontSize: 22, bold: true, color: C.green, margin: 0,
    });

    // Back button
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: bx + 0.2, y: by + 2.8, w: bw - 0.4, h: 0.45,
      fill: { color: C.dark }, line: { color: C.dark, width: 0 }, rectRadius: 0.06,
    });
    s.addText("Back to Database", {
      x: bx + 0.2, y: by + 2.8, w: bw - 0.4, h: 0.45,
      fontFace: HEADER_FONT, fontSize: 12, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0,
    });

    footer(s, 15, TOTAL);

    s.addNotes(
      "Both ML modules support what we call sandbox mode. You upload a CSV — a historical export, " +
      "synthetic data, whatever — and the same pipeline runs entirely in memory, without touching the database. " +
      "A yellow banner shows whenever you're in simulation mode so it's obvious. Useful for safe demos, " +
      "for comparing two months by uploading each one, or for testing on synthetic datasets."
    );
  }

  // ─── SLIDE 16 — Quality / Tooling ───────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.bg };
    slideHeader(s, "Quality is part of the project, not an afterthought", "15 · QUALITY & TOOLING");

    // Left: stat callouts
    const stats = [
      { n: "17", l: "passing unit tests" },
      { n: ".env.local", l: "secrets, never committed" },
      { n: "Swagger UI", l: "live API contract" },
      { n: "1 script", l: "to install & run from scratch" },
    ];
    stats.forEach((st, i) => {
      const x = 0.55 + (i % 2) * 2.4;
      const y = 1.4 + Math.floor(i / 2) * 1.55;
      s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x, y, w: 2.25, h: 1.35,
        fill: { color: C.card }, line: { color: C.border, width: 0.75 },
        rectRadius: 0.1,
        shadow: { type: "outer", color: "0F172A", opacity: 0.08, blur: 12, offset: 3, angle: 90 },
      });
      s.addText(st.n, {
        x: x + 0.2, y: y + 0.25, w: 1.95, h: 0.6,
        fontFace: HEADER_FONT, fontSize: 24, bold: true, color: C.primary, margin: 0,
      });
      s.addText(st.l, {
        x: x + 0.2, y: y + 0.85, w: 1.95, h: 0.45,
        fontFace: BODY_FONT, fontSize: 11, color: C.muted, margin: 0,
      });
    });

    // Right: covered scope
    const rx = 5.6, ry = 1.4, rw = 3.9, rh = 3.5;
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: rx, y: ry, w: rw, h: rh,
      fill: { color: C.dark }, line: { color: C.dark, width: 0 }, rectRadius: 0.12,
    });
    s.addText("TEST COVERAGE", {
      x: rx + 0.3, y: ry + 0.25, w: rw - 0.6, h: 0.3,
      fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.mutedInv, charSpacing: 4, margin: 0,
    });
    s.addText("What we verify", {
      x: rx + 0.3, y: ry + 0.55, w: rw - 0.6, h: 0.45,
      fontFace: HEADER_FONT, fontSize: 18, bold: true, color: "FFFFFF", margin: 0,
    });
    const coverage = [
      "Registration & login endpoints",
      "Token authentication",
      "Profile guard — role escalation blocked",
      "Phone number required on signup",
      "Reservation overlap detection",
      "Past-date reservations rejected",
      "Hourly pricing calculation",
    ];
    coverage.forEach((t, i) => {
      const y = ry + 1.1 + i * 0.3;
      s.addImage({ data: I.check, x: rx + 0.3, y: y + 0.04, w: 0.16, h: 0.16 });
      s.addText(t, {
        x: rx + 0.55, y: y - 0.04, w: rw - 0.85, h: 0.3,
        fontFace: BODY_FONT, fontSize: 11, color: C.textInv, margin: 0,
      });
    });

    footer(s, 16, TOTAL);

    s.addNotes(
      "Quality wasn't an afterthought. We wrote 17 automated unit tests covering registration, login, " +
      "token authentication, the role-escalation guard we mentioned earlier, phone-number validation, " +
      "reservation overlap detection, past-date rejection, and the pricing calculation. A small batch script " +
      "called testowanie.bat runs them all with color-coded output. Secrets all live in .env.local with " +
      "an .env.example template committed for reviewers. And the whole project — database, migrations, " +
      "seeded data, frontend, backend — bootstraps from a single install-and-run.bat script."
    );
  }

  // ─── SLIDE 17 — Thank You ───────────────────────────────────
  {
    const s = pptx.addSlide();
    s.background = { color: C.dark };

    // Decorative ovals (all coordinates kept non-negative)
    s.addShape(pptx.shapes.OVAL, {
      x: 0, y: 0, w: 5, h: 5,
      fill: { color: C.primary, transparency: 80 }, line: { color: C.primary, width: 0 },
    });
    s.addShape(pptx.shapes.OVAL, {
      x: 7, y: 3, w: 5, h: 5,
      fill: { color: C.secondary, transparency: 75 }, line: { color: C.secondary, width: 0 },
    });

    // G badge
    s.addShape(pptx.shapes.OVAL, {
      x: 4.45, y: 1.1, w: 1.1, h: 1.1,
      fill: { color: C.primary }, line: { color: C.primary, width: 0 },
    });
    s.addText("G", {
      x: 4.45, y: 1.1, w: 1.1, h: 1.1,
      fontFace: HEADER_FONT, fontSize: 60, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", margin: 0,
    });

    s.addText("Thank you", {
      x: 0.55, y: 2.45, w: 9, h: 1.0,
      fontFace: HEADER_FONT, fontSize: 56, bold: true, color: "FFFFFF",
      align: "center", margin: 0,
    });
    s.addText("Questions?  Or — let me run a live demo.", {
      x: 0.55, y: 3.55, w: 9, h: 0.5,
      fontFace: BODY_FONT, fontSize: 18, color: C.mutedInv, italic: true,
      align: "center", margin: 0,
    });

    // Links row
    const links = [
      { l: "REPO",         t: "github.com/xtfee/GarageOnDemand" },
      { l: "DEMO LOGIN",   t: "admin / admin  ·  client1 / password123" },
      { l: "STRIPE CARD",  t: "4242 4242 4242 4242  ·  any future date · any CVC" },
    ];
    links.forEach((lk, i) => {
      const y = 4.35 + i * 0.32;
      s.addText(lk.l, {
        x: 1.5, y, w: 2.2, h: 0.28,
        fontFace: BODY_FONT, fontSize: 10, bold: true, color: C.mutedInv,
        charSpacing: 3, align: "right", margin: 0,
      });
      s.addText(lk.t, {
        x: 3.8, y, w: 5.5, h: 0.28,
        fontFace: BODY_FONT, fontSize: 11, color: "FFFFFF", margin: 0,
      });
    });

    s.addNotes(
      "That's Garage OnDemand. Thanks for listening. We're happy to take questions, or — if you want — " +
      "we can run a live demo right now. The code is on GitHub at the URL on screen, with the demo " +
      "credentials and the Stripe test card listed below. Thank you."
    );
  }

  // ─── Write ────────────────────────────────────────────────────
  await pptx.writeFile({ fileName: "GarageOnDemand.pptx" });
  console.log("✓ Wrote GarageOnDemand.pptx");

  // pptxgenjs 4.x writes <p:notesMasterIdLst> in the wrong XML position
  // when addNotes() is used. Fix that so PowerPoint stops complaining.
  const { spawnSync } = require("child_process");
  const r = spawnSync("python", ["fix_pptx.py", "GarageOnDemand.pptx"], {
    encoding: "utf8", stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("WARNING: fix_pptx.py failed — PowerPoint may show a repair prompt.");
  }
})();
