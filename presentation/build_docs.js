// Garage OnDemand — technical documentation
// Run with:  node build_docs.js
// Output:    GarageOnDemand-Documentation.docx

const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, ExternalHyperlink, TabStopType, TabStopPosition,
  TableOfContents,
} = require("docx");

// ── Page geometry: A4 (Polish academic standard) ────────────
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1440;                  // 1 inch
const CONTENT_W = PAGE_W - MARGIN * 2; // 9026 DXA

// ── Colors ──────────────────────────────────────────────────
const C = {
  primary: "4F46E5", // indigo
  dark: "0F172A",
  text: "1E293B",
  muted: "64748B",
  border: "CBD5E1",
  shadeHeader: "EEF2FF",
  shadeAlt: "F8FAFC",
};

// ── Shortcuts ───────────────────────────────────────────────
const H1 = (text, opts = {}) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  pageBreakBefore: opts.newPage !== false,
  children: [new TextRun({ text, font: "Cambria", color: C.dark, bold: true })],
  spacing: { before: 240, after: 200 },
});
const H2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, font: "Cambria", color: C.primary, bold: true })],
  spacing: { before: 240, after: 120 },
});
const H3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, font: "Cambria", color: C.text, bold: true })],
  spacing: { before: 180, after: 90 },
});
const P = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, font: "Calibri", size: 22, color: C.text, ...opts })],
  spacing: { before: 60, after: 100, line: 300 },
  alignment: AlignmentType.JUSTIFIED,
});
const PR = (runs) => new Paragraph({
  children: runs.map(r => typeof r === "string"
    ? new TextRun({ text: r, font: "Calibri", size: 22, color: C.text })
    : new TextRun({ font: "Calibri", size: 22, color: C.text, ...r })),
  spacing: { before: 60, after: 100, line: 300 },
  alignment: AlignmentType.JUSTIFIED,
});
const CODE = (text) => new Paragraph({
  children: [new TextRun({ text, font: "Consolas", size: 20, color: C.dark })],
  shading: { type: ShadingType.CLEAR, fill: C.shadeAlt, color: "auto" },
  spacing: { before: 60, after: 60 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.primary, space: 6 } },
});
const BULLET = (text) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: [new TextRun({ text, font: "Calibri", size: 22, color: C.text })],
  spacing: { before: 40, after: 40 },
});
const BULLETR = (runs) => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  children: runs.map(r => typeof r === "string"
    ? new TextRun({ text: r, font: "Calibri", size: 22, color: C.text })
    : new TextRun({ font: "Calibri", size: 22, color: C.text, ...r })),
  spacing: { before: 40, after: 40 },
});

// Two-column simple table for spec listings
function specTable(headerLeft, headerRight, rows, leftWidth = 2800) {
  const rightWidth = CONTENT_W - leftWidth;
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.border };
  const borders = { top: border, bottom: border, left: border, right: border };
  const margins = { top: 100, bottom: 100, left: 140, right: 140 };

  const headerRow = new TableRow({
    children: [
      new TableCell({
        width: { size: leftWidth, type: WidthType.DXA },
        borders,
        margins,
        shading: { type: ShadingType.CLEAR, fill: C.shadeHeader, color: "auto" },
        children: [new Paragraph({
          children: [new TextRun({ text: headerLeft, font: "Cambria", size: 22, bold: true, color: C.primary })],
        })],
      }),
      new TableCell({
        width: { size: rightWidth, type: WidthType.DXA },
        borders,
        margins,
        shading: { type: ShadingType.CLEAR, fill: C.shadeHeader, color: "auto" },
        children: [new Paragraph({
          children: [new TextRun({ text: headerRight, font: "Cambria", size: 22, bold: true, color: C.primary })],
        })],
      }),
    ],
  });

  const dataRows = rows.map((r, i) => new TableRow({
    children: [
      new TableCell({
        width: { size: leftWidth, type: WidthType.DXA },
        borders, margins,
        shading: i % 2 ? { type: ShadingType.CLEAR, fill: C.shadeAlt, color: "auto" } : undefined,
        children: [new Paragraph({
          children: [new TextRun({ text: r[0], font: "Calibri", size: 21, bold: true, color: C.text })],
        })],
      }),
      new TableCell({
        width: { size: rightWidth, type: WidthType.DXA },
        borders, margins,
        shading: i % 2 ? { type: ShadingType.CLEAR, fill: C.shadeAlt, color: "auto" } : undefined,
        children: [new Paragraph({
          children: [new TextRun({ text: r[1], font: "Calibri", size: 21, color: C.text })],
        })],
      }),
    ],
  }));

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [leftWidth, rightWidth],
    rows: [headerRow, ...dataRows],
  });
}

// Three-column table for tech stack
function techTable(rows) {
  const w1 = 2200, w2 = 1400, w3 = CONTENT_W - w1 - w2;
  const border = { style: BorderStyle.SINGLE, size: 4, color: C.border };
  const borders = { top: border, bottom: border, left: border, right: border };
  const margins = { top: 80, bottom: 80, left: 120, right: 120 };

  const head = new TableRow({
    children: [["Library", w1], ["Version", w2], ["Purpose", w3]].map(([t, w]) =>
      new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders, margins,
        shading: { type: ShadingType.CLEAR, fill: C.shadeHeader, color: "auto" },
        children: [new Paragraph({
          children: [new TextRun({ text: t, font: "Cambria", size: 22, bold: true, color: C.primary })],
        })],
      })),
  });

  const body = rows.map((r, i) => new TableRow({
    children: [
      [r[0], w1, true],
      [r[1], w2, false],
      [r[2], w3, false],
    ].map(([t, w, bold]) => new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders, margins,
      shading: i % 2 ? { type: ShadingType.CLEAR, fill: C.shadeAlt, color: "auto" } : undefined,
      children: [new Paragraph({
        children: [new TextRun({ text: t, font: "Calibri", size: 21, bold: !!bold, color: C.text })],
      })],
    })),
  }));

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [w1, w2, w3],
    rows: [head, ...body],
  });
}

// ── Build document ─────────────────────────────────────────
const content = [];

// ════════════════════════════════════════════════════════════
//  TITLE PAGE
// ════════════════════════════════════════════════════════════
content.push(
  new Paragraph({
    children: [new TextRun({ text: "", font: "Calibri", size: 22 })],
    spacing: { before: 2400 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "FINAL PROJECT DOCUMENTATION", font: "Cambria", size: 22, color: C.muted, bold: true })],
    spacing: { after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Garage OnDemand", font: "Cambria", size: 80, color: C.primary, bold: true })],
    spacing: { after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: "A platform for short-term rental of fully equipped workshop garages",
      font: "Calibri", size: 26, color: C.muted, italics: true,
    })],
    spacing: { after: 1600 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Authors", font: "Cambria", size: 22, color: C.muted, bold: true })],
    spacing: { after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Bartłomiej   ·   Michał   ·   Oscar", font: "Cambria", size: 32, color: C.text, bold: true })],
    spacing: { after: 1600 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "2026", font: "Cambria", size: 24, color: C.text, bold: true })],
    spacing: { after: 120 },
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ExternalHyperlink({
      link: "https://github.com/xtfee/GarageOnDemand",
      children: [new TextRun({
        text: "github.com/xtfee/GarageOnDemand",
        font: "Calibri", size: 22, color: C.primary, underline: {},
      })],
    })],
  }),
);

// ════════════════════════════════════════════════════════════
//  TABLE OF CONTENTS
// ════════════════════════════════════════════════════════════
content.push(
  H1("Table of Contents", { newPage: true }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
);

// ════════════════════════════════════════════════════════════
//  1. INTRODUCTION
// ════════════════════════════════════════════════════════════
content.push(
  H1("1. Introduction"),

  H2("1.1 Project Overview"),
  P("Garage OnDemand is a web-based platform for short-term rental of fully equipped workshop garages. " +
    "The system enables hobbyists, do-it-yourself car owners, and small independent mechanics to reserve " +
    "a workshop bay by the hour or by the day, complete payment online, and obtain immediate access via " +
    "a unique six-digit PIN. On the operator side, administrators have full control over the catalogue " +
    "of garages, customer accounts, the reservation lifecycle, system parameters, and a business " +
    "intelligence dashboard with two embedded machine-learning modules."),
  P("The project was developed as a final-year group assignment by Bartłomiej, Michał and Oscar. The " +
    "complete source code is available at the repository linked on the title page."),

  H2("1.2 Problem Statement"),
  P("People who occasionally need access to professional workshop equipment face three distinct " +
    "friction points that the current market does not address well:"),
  BULLETR([
    { text: "Lack of space.", bold: true },
    " Apartments and small homes do not accommodate a hydraulic lift, a service pit, " +
    "or a MIG/MAG welder.",
  ]),
  BULLETR([
    { text: "Cost of ownership.", bold: true },
    " Purchasing professional tools for sporadic use is economically irrational; " +
    "a basic two-post lift alone costs several thousand euros.",
  ]),
  BULLETR([
    { text: "Booking logistics.", bold: true },
    " Existing workshop rental services typically operate via phone reservations " +
    "or paper schedules with no real-time availability, no online payment, and no self-service.",
  ]),
  P("Garage OnDemand removes all three friction points by offering a fully online discovery, booking, " +
    "payment and access flow that can be completed in under one minute."),

  H2("1.3 Target Audience"),
  BULLETR([{ text: "Hobbyists ", bold: true },
    "— DIY car restorers, motorcycle enthusiasts, and weekend mechanics."]),
  BULLETR([{ text: "DIY car owners ", bold: true },
    "— individuals performing their own oil changes, brake replacements, or seasonal tyre swaps."]),
  BULLETR([{ text: "Independent mechanics ", bold: true },
    "— small operators who do not own a workshop and need temporary professional space."]),

  H2("1.4 Project Goals"),
  P("The development team set the following measurable goals:"),
  BULLETR([{ text: "1. ", bold: true },
    "Provide a seamless discovery → reservation → payment → access flow completable in under sixty seconds."]),
  BULLETR([{ text: "2. ", bold: true },
    "Enable operators to manage the full catalogue, pricing rules and customer accounts through a " +
    "dedicated administrative interface."]),
  BULLETR([{ text: "3. ", bold: true },
    "Demonstrate measurable business insight through analytics charts and two machine-learning techniques."]),
  BULLETR([{ text: "4. ", bold: true },
    "Maintain automated test coverage, a documented public API, externalised secrets management, and " +
    "a one-script bootstrap appropriate for a deployable application."]),
);

// ════════════════════════════════════════════════════════════
//  2. FUNCTIONAL REQUIREMENTS
// ════════════════════════════════════════════════════════════
content.push(
  H1("2. Functional Requirements"),

  H2("2.1 Client Features"),
  BULLETR([{ text: "Account management.", bold: true },
    " Sign up via email and password with a verification link, or via Google OAuth 2.0. Update profile, " +
    "change password, delete account."]),
  BULLETR([{ text: "Catalogue browsing.", bold: true },
    " View the full offer with photographs and filter by city, hourly price, and required equipment."]),
  BULLETR([{ text: "Smart reservation calendar.", bold: true },
    " Drag-select multiple days on a month grid, or select a single day and drag a precise hourly range " +
    "on a 24-hour timeline. Real-time validation prevents conflicts, past-date bookings, and exceeding " +
    "the configured maximum reservation length."]),
  BULLETR([{ text: "Online payment.", bold: true },
    " Stripe Elements integration with a fifteen-minute payment window. Unpaid reservations are " +
    "automatically cancelled."]),
  BULLETR([{ text: "Access PIN.", bold: true },
    " A six-digit code is generated upon confirmation and revealed in the client dashboard."]),
  BULLETR([{ text: "Active reservation management.", bold: true },
    " Extend a confirmed reservation by hours or by a full day with a follow-up payment; emergency-cancel " +
    "with an automatic refund issued through the Stripe Refund API if more than 24 hours remain before " +
    "the reservation start."]),
  BULLETR([{ text: "Personal dashboard.", bold: true },
    " View upcoming reservations and history with status filters, a live payment countdown for pending " +
    "items, and a wallet view summarising all payments."]),

  H2("2.2 Administrator Features"),
  BULLETR([{ text: "Catalogue management.", bold: true },
    " Full CRUD for garages, equipment items, and users (including activation, blocking, and forced " +
    "creation with a chosen role)."]),
  BULLETR([{ text: "Reservation control.", bold: true },
    " Change reservation status, emergency-cancel with a reason that is delivered to the client as an " +
    "in-app notification, and mark customers as " +
    "“overstayed” to block them from creating new bookings until cleared."]),
  BULLETR([{ text: "Availability calendar.", bold: true },
    " Month overview per garage with colour-coded availability — free, partial, fully booked."]),
  BULLETR([{ text: "System configuration.", bold: true },
    " Refund grace period in hours, maximum number of active reservations per user, maximum reservation " +
    "length in days, and default hourly and daily pricing for the new-garage form."]),
  BULLETR([{ text: "Analytics dashboard.", bold: true },
    " Revenue over time line chart, top-ten popularity ranking, and a weekday × hour occupancy heatmap. " +
    "All visualisations are filterable by date range and equipment."]),
  BULLETR([{ text: "Machine-learning modules.", bold: true },
    " Apriori association rule mining and a churn-prediction decision tree, both runnable on the live " +
    "database or on an uploaded CSV file (sandbox mode)."]),
);

// ════════════════════════════════════════════════════════════
//  3. NON-FUNCTIONAL REQUIREMENTS
// ════════════════════════════════════════════════════════════
content.push(
  H1("3. Non-Functional Requirements"),

  H2("3.1 Security"),
  BULLET("Passwords are hashed using Django's PBKDF2 implementation (built-in)."),
  BULLET("Email-and-password sign-ups require verification before the account becomes active."),
  BULLET("Roles are server-side enforced; the public profile endpoint explicitly ignores any role field " +
    "submitted in a request body to prevent privilege escalation. A dedicated unit test asserts this behaviour."),
  BULLET("All secrets — Django SECRET_KEY, database password, Stripe API keys, Gmail SMTP password, " +
    "Google OAuth client ID and secret — are loaded from .env.local via python-dotenv. The file is gitignored."),
  BULLET("Stripe Elements ensures full card numbers never reach the application backend."),
  BULLET("Account deletion requires password confirmation."),

  H2("3.2 Performance"),
  BULLET("The frontend is built with Vite, producing minified, code-split production bundles."),
  BULLET("Serializers use bulk queries and prefetching for related sets (garage equipment, reservation user)."),
  BULLET("The Apriori algorithm and Decision Tree fit comfortably in memory for the seeded dataset " +
    "of approximately 1,500 historical reservations."),
  BULLET("Calendar availability is computed per request from a focused query, not via materialised tables, " +
    "which simplifies invalidation."),

  H2("3.3 Usability"),
  BULLET("Responsive design implemented with Tailwind CSS and DaisyUI."),
  BULLET("Drag-and-drop calendar and timeline significantly reduce booking friction."),
  BULLET("Real-time validation prevents impossible bookings before submission."),
  BULLET("Empty states are explicit and offer a next action (e.g., a “Reserve a Garage” button " +
    "when the upcoming-reservations list is empty)."),
  BULLET("All user-facing copy is in English to support an international audience."),

  H2("3.4 Maintainability"),
  BULLET("The entire project bootstraps from a single Windows batch script (install-and-run.bat)."),
  BULLET("The test suite is executed via a separate batch script (testowanie.bat)."),
  BULLET("Configuration is externalised through a .env.local file, with a committed .env.example template."),
  BULLET("The public API contract is automatically documented via drf-spectacular and served at " +
    "/api/schema/swagger-ui/."),
  BULLET("Migrations are auto-regenerated on full reset to guarantee schema consistency."),
);

// ════════════════════════════════════════════════════════════
//  4. SYSTEM ARCHITECTURE
// ════════════════════════════════════════════════════════════
content.push(
  H1("4. System Architecture"),

  H2("4.1 High-Level Architecture"),
  P("The system follows a three-tier architecture with clear separation between presentation, " +
    "application, and persistence:"),
  BULLETR([{ text: "Presentation tier ", bold: true },
    "— a Vue 3 Single Page Application served by Vite on localhost:5173. The SPA is responsible " +
    "for all UI rendering, client-side routing, form validation, and communication with the backend."]),
  BULLETR([{ text: "Application tier ", bold: true },
    "— a Django REST Framework API served by Django's development server on 127.0.0.1:8000. This " +
    "tier handles authentication, business logic, Stripe payment orchestration, machine-learning " +
    "computation, and email delivery."]),
  BULLETR([{ text: "Persistence tier ", bold: true },
    "— a PostgreSQL 17 database named garaz_db, accessed via the psycopg2-binary driver. Migrations " +
    "are owned by Django."]),
  P("Three external services are integrated into the application tier:"),
  BULLETR([{ text: "Stripe ", bold: true },
    "— for PaymentIntent creation, charge confirmation, and refund issuance in test mode."]),
  BULLETR([{ text: "Gmail SMTP ", bold: true },
    "— for delivering verification emails on registration and on email-address changes."]),
  BULLETR([{ text: "Google OAuth 2.0 ", bold: true },
    "— for one-click sign-in through django-allauth."]),

  H2("4.2 Authentication Flow"),
  P("Token authentication (Django REST Framework's built-in) is used for the SPA:"),
  BULLET("The client submits credentials to POST /api/accounts/login/."),
  BULLET("On success, the backend returns a token together with the user's role, username and email."),
  BULLET("The SPA stores the token in localStorage and attaches it as Authorization: Token <key> on " +
    "every subsequent request via an Axios interceptor."),
  P("For Google sign-in the flow is more elaborate. The user is redirected to /accounts/google/login/, " +
    "completes the OAuth dance, and lands on /api/accounts/social/success/. That view generates a token, " +
    "ensures a sensible username is populated (deriving one from the user's email if necessary), and " +
    "redirects to localhost:5173/auth-callback?token=<key>. The SPA stores the token and then fetches " +
    "/api/accounts/profile/ to populate the navigation bar with the correct username and role."),

  H2("4.3 Reservation Data Flow"),
  P("The reservation creation flow involves a coordinated dance between the SPA, the backend, and Stripe:"),
  BULLETR([{ text: "1. ", bold: true },
    "The user selects dates and times in ReservationView.vue."]),
  BULLETR([{ text: "2. ", bold: true },
    "The frontend issues POST /api/garages/reservations/ with the garage, start time, and end time."]),
  BULLETR([{ text: "3. ", bold: true },
    "ReservationSerializer.validate performs five checks: outstanding overstay block, end-after-start, " +
    "no past dates, maximum duration, and no conflicts. On success it computes total_price."]),
  BULLETR([{ text: "4. ", bold: true },
    "ReservationViewSet.perform_create generates a random six-digit access code and persists the row " +
    "with status pending."]),
  BULLETR([{ text: "5. ", bold: true },
    "The frontend immediately calls POST /api/create-payment-intent/<id>/, which calls Stripe and " +
    "returns a clientSecret."]),
  BULLETR([{ text: "6. ", bold: true },
    "Stripe Elements collects card details directly from the user and confirms the payment client-side."]),
  BULLETR([{ text: "7. ", bold: true },
    "On success the frontend calls POST /api/garages/save-payment/, which marks the reservation " +
    "confirmed and records the Payment row."]),
  BULLETR([{ text: "8. ", bold: true },
    "If the user does not pay within fifteen minutes, the next API call triggers " +
    "clean_expired_reservations which marks the row as cancelled."]),
);

// ════════════════════════════════════════════════════════════
//  5. TECHNOLOGY STACK
// ════════════════════════════════════════════════════════════
content.push(
  H1("5. Technology Stack"),

  H2("5.1 Frontend"),
  techTable([
    ["Vue.js",            "3.5",    "Reactive component framework with the Composition API"],
    ["Vite",              "7.x",    "Development server and production bundler"],
    ["Tailwind CSS",      "3.4",    "Utility-first CSS framework"],
    ["DaisyUI",           "5.5",    "Pre-styled component classes built on Tailwind"],
    ["Vue Router",        "4.6",    "Client-side routing with route guards"],
    ["Axios",             "1.13",   "HTTP client with interceptors for token injection"],
    ["Chart.js",          "4.5",    "Charts for the analytics dashboard"],
    ["vue-chartjs",       "5.3",    "Vue wrapper for Chart.js"],
    ["Stripe.js",         "8.7",    "Payment Elements integration"],
    ["VueDatePicker",     "12.1",   "Date picker widget"],
  ]),

  H2("5.2 Backend"),
  techTable([
    ["Python",                 "3.14",   "Runtime"],
    ["Django",                 "6.0",    "Web framework and ORM"],
    ["Django REST Framework",  "3.16",   "API toolkit, token authentication, viewsets"],
    ["django-allauth",         "latest", "Google OAuth integration"],
    ["psycopg2-binary",        "2.9",    "PostgreSQL driver"],
    ["stripe",                 "14.1",   "Official Stripe API client"],
    ["python-dotenv",          "1.2",    "Loading .env.local at startup"],
    ["drf-spectacular",        "0.28",   "OpenAPI 3 schema and Swagger UI"],
    ["django-cors-headers",    "4.9",    "CORS configuration for the SPA origin"],
  ]),

  H2("5.3 Data Science and Machine Learning"),
  techTable([
    ["pandas",       "2.3",  "DataFrame manipulation, CSV import/export"],
    ["mlxtend",      "0.24", "Apriori algorithm and association rule mining"],
    ["scikit-learn", "1.8",  "DecisionTreeClassifier"],
    ["matplotlib",   "3.10", "Tree visualisation rendered to PNG"],
    ["numpy",        "<2.4", "Numerical backend"],
  ]),

  H2("5.4 Database"),
  P("PostgreSQL 17 is the production database. The application opens a connection on 127.0.0.1:5432 " +
    "and authenticates with credentials supplied by the .env.local file. Django manages schema migrations."),
);

// ════════════════════════════════════════════════════════════
//  6. DATABASE DESIGN
// ════════════════════════════════════════════════════════════
content.push(
  H1("6. Database Design"),

  H2("6.1 Entity Overview"),
  P("The schema contains seven primary entities, summarised below."),
  specTable("Entity", "Purpose", [
    ["User",         "Extends Django's AbstractUser with role, email_verified, and phone_number."],
    ["Garage",       "Catalogue row: name, address, hourly and daily price, dimensions, image, equipment many-to-many."],
    ["Equipment",    "Tool or facility (lift, welder, pit, etc.) attachable to garages; carries an emoji icon."],
    ["Reservation", "Links a user to a garage for a specific time range with status, total price, and access code."],
    ["Payment",      "Records a Stripe transaction tied to a reservation (initial payment or extension)."],
    ["SystemConfig", "Singleton row holding system-wide policy values (refund hours, limits, default prices)."],
    ["SocialApp",    "django-allauth row holding the Google OAuth client ID and secret."],
  ], 2200),

  H2("6.2 Relationships"),
  BULLET("A User has many Reservation rows (one-to-many)."),
  BULLET("A Garage has many Reservation rows (one-to-many)."),
  BULLET("A Garage has many Equipment rows through an automatically generated join table (many-to-many)."),
  BULLET("A Reservation has many Payment rows (one-to-many; an extension creates an additional Payment)."),
  BULLET("SystemConfig is a singleton — a custom save method enforces a single row."),

  H2("6.3 Reservation State Machine"),
  P("A reservation flows through five distinct states:"),
  BULLETR([{ text: "pending ", bold: true },
    "— created but not yet paid. Transitions to confirmed on successful payment, or to cancelled after " +
    "fifteen minutes without payment or on emergency cancellation."]),
  BULLETR([{ text: "confirmed ", bold: true },
    "— paid and ready to use. Transitions to completed after end_time has passed, or to cancelled on " +
    "emergency cancellation (a refund is issued if more than twenty-four hours remain before start)."]),
  BULLETR([{ text: "cancelled ", bold: true },
    "— terminal state; reason and notification visibility are tracked on the row."]),
  BULLETR([{ text: "completed ", bold: true },
    "— terminal state; the reservation period has elapsed."]),
  BULLETR([{ text: "expired ", bold: true },
    "— alternative terminal label used for historical imports."]),
);

// ════════════════════════════════════════════════════════════
//  7. REST API
// ════════════════════════════════════════════════════════════
content.push(
  H1("7. REST API"),
  P("The full OpenAPI 3 specification is generated automatically by drf-spectacular and served at " +
    "http://127.0.0.1:8000/api/schema/swagger-ui/ when the development server is running. Key " +
    "endpoints are summarised below."),

  H2("7.1 Accounts (/api/accounts/)"),
  specTable("Method · Path", "Purpose", [
    ["POST /register/",                "Create account, send verification email, account inactive until verified."],
    ["GET  /verify/<uid>/<token>/",     "Activate account from verification link."],
    ["POST /login/",                    "Exchange credentials for a DRF auth token."],
    ["POST /logout/",                   "Invalidate session."],
    ["GET|PATCH /profile/",             "Retrieve or update own profile. Role updates are ignored server-side."],
    ["PUT /change-password/",           "Change password (requires the old password)."],
    ["POST /confirm-email-change/",     "Confirm email change via signed link."],
    ["DELETE /delete/",                 "Delete account (requires password confirmation)."],
    ["GET|POST /users/...",             "Admin-only user management endpoints (UserViewSet)."],
    ["GET /social/success/",            "Internal redirect target used by django-allauth after Google sign-in."],
  ], 3000),

  H2("7.2 Garages and Equipment (/api/garages/)"),
  specTable("Method · Path", "Purpose", [
    ["GET|POST|PUT|DELETE /list/",       "Garage CRUD (admin for write, public for read)."],
    ["GET /list/<id>/check_availability/", "Busy hours for a single day on a given garage."],
    ["GET /list/<id>/check_month_availability/", "Day-level availability map for a calendar month."],
    ["GET|POST|PUT|DELETE /equipment/",  "Equipment catalogue (admin for write, authenticated for list)."],
  ], 3000),

  H2("7.3 Reservations"),
  specTable("Method · Path", "Purpose", [
    ["GET|POST|PATCH|DELETE /reservations/",     "Reservation CRUD; clients see only their own rows."],
    ["POST /reservations/<id>/emergency_cancel/", "Emergency cancellation with optional reason. Refund issued if >24h before start."],
    ["POST /reservations/<id>/initiate_extension/", "Begin a paid extension; returns a Stripe clientSecret."],
    ["POST /reservations/<id>/confirm_extension/",  "Finalise an extension after successful Stripe payment."],
    ["POST /reservations/<id>/mark_overstay/",      "Admin-only flag for customers who overstayed their booking."],
    ["GET /reservations/active_notifications/",     "Pending cancellation notifications for the current user."],
    ["POST /reservations/<id>/mark_seen/",          "Mark a cancellation notification as read."],
    ["GET|POST /system-config/",                    "System policy values (write requires admin)."],
  ], 3300),

  H2("7.4 Payments"),
  specTable("Method · Path", "Purpose", [
    ["POST /api/create-payment-intent/<id>/", "Create a Stripe PaymentIntent for a pending reservation."],
    ["POST /api/garages/save-payment/",        "Finalise the reservation after Stripe confirms the payment."],
  ], 3500),

  H2("7.5 Analytics and Machine Learning"),
  specTable("Method · Path", "Purpose", [
    ["GET /analytics-data/",              "Revenue series, popularity ranking, and the heatmap matrix."],
    ["GET /ml-results/",                  "Apriori association rules over the live database."],
    ["POST /ml-results/",                  "Same as above but over an uploaded CSV (sandbox mode)."],
    ["GET /visualize-decision-tree/",      "Decision tree image as a base64 data URI."],
    ["POST /visualize-decision-tree/",     "Decision tree over an uploaded CSV (sandbox)."],
    ["GET /export/",                       "Export current data set used by Apriori as CSV."],
    ["GET /export-history/",               "Export the full reservation history as CSV."],
    ["GET /export-decision-tree/",         "Export the training data set used by the tree as CSV."],
    ["POST /analyze-csv/",                 "Re-run the analytics dashboard on an uploaded CSV."],
  ], 3300),
);

// ════════════════════════════════════════════════════════════
//  8. USER FEATURES (DETAILED)
// ════════════════════════════════════════════════════════════
content.push(
  H1("8. User Features (Detailed)"),

  H2("8.1 Discovery"),
  P("Two views support discovery. HomeView.vue presents a horizontally scrollable carousel of six " +
    "recommended garages with a single hero-search input. OfferView.vue presents the full catalogue " +
    "as a responsive card grid with a filter modal."),
  P("Filtering supports three dimensions: city (extracted from the address field), maximum hourly " +
    "rate (range slider with realistic European pricing up to €50/h), and required equipment (multi-select " +
    "checkbox list). Filters are applied client-side after one initial fetch of the full catalogue."),

  H2("8.2 Smart Reservation Calendar"),
  P("ReservationView.vue contains the smart calendar widget. The interaction model is:"),
  BULLET("Click and drag across the month grid to pick a multi-day range."),
  BULLET("Pick a single day on the calendar and a 24-cell hourly timeline appears below. Click and " +
    "drag across the timeline to select an exact range of hours."),
  P("Three visual states colour the timeline cells:"),
  BULLET("Grey — hours in the past (disabled)."),
  BULLET("Red — hours already booked by another reservation."),
  BULLET("Indigo — the current selection."),
  P("Server-side validation runs on submission: the user must not have an outstanding overstay block, " +
    "the end time must be after the start time, the start must not be in the past, the total duration " +
    "must not exceed SystemConfig.max_reservation_days, and the user must not have hit the configured " +
    "maximum number of active reservations. Pricing is computed dynamically: for short slots the system " +
    "applies the hourly rate, while for bookings of 24 hours or more it applies the daily discounted " +
    "rate proportionally."),

  H2("8.3 Payment Flow"),
  P("Once the user confirms the reservation, the frontend transitions to step 2 which embeds Stripe " +
    "Elements. The flow is:"),
  BULLET("Backend creates a PaymentIntent for the calculated total."),
  BULLET("Frontend mounts the Stripe payment element with the returned clientSecret."),
  BULLET("On submission, Stripe Elements confirms the payment client-side."),
  BULLET("Frontend posts back to /api/garages/save-payment/ which records the Payment row and marks the " +
    "reservation as confirmed."),
  P("A global floating timer (GlobalPaymentTimer.vue) is rendered on top of the application whenever the " +
    "current user has at least one pending reservation. It shows a live countdown to the deadline and a " +
    "shortcut button that returns the user to the payment screen for that reservation."),

  H2("8.4 Access PIN"),
  P("Each reservation row carries an access_code field populated at creation time with a random six-digit " +
    "PIN. The PIN is hidden until the reservation is confirmed and is revealed in the client dashboard " +
    "by clicking a key icon next to the relevant row. In a production deployment this code would be the " +
    "value entered on the physical keypad at the garage entrance."),

  H2("8.5 Client Dashboard"),
  P("UserDashboard.vue is organised into three top-level tabs: My Reservations, Payments, and Settings."),
  P("The Reservations tab is further split into Upcoming and History sub-tabs and supports filtering by " +
    "status, sorting, and pagination. Each reservation row shows the date range, the total in euros, the " +
    "current status badge and contextual actions: pay for pending bookings, extend or cancel confirmed " +
    "bookings, reveal the access PIN."),
  P("The Payments tab presents a transaction-style table with date, garage name, status, and amount. " +
    "Aggregate totals appear in the Wallet card at the top."),
  P("The Settings tab supports updating the email address (which triggers a re-verification flow), " +
    "changing the password, and deleting the account. Every change requires password confirmation."),
);

// ════════════════════════════════════════════════════════════
//  9. ADMINISTRATOR FEATURES (DETAILED)
// ════════════════════════════════════════════════════════════
content.push(
  H1("9. Administrator Features (Detailed)"),

  H2("9.1 Garage Management"),
  P("AdminDashboard.vue exposes a tabbed interface for the six administrative resources. The Garages " +
    "tab presents a table of all rows with thumbnail, name, address, pricing and a compact equipment " +
    "summary. A modal form supports both creation and editing, with fields for name, address, hourly " +
    "and daily price, description, image upload, and an equipment checkbox grid."),

  H2("9.2 User Management"),
  P("Administrators can list every user with their role, activation status, and contact details. A " +
    "row-level Block/Unblock action toggles is_active. The role of an existing user cannot be changed " +
    "through this form; the role select is disabled when editing, which mirrors the server-side guard."),

  H2("9.3 Reservation Control"),
  P("The Reservations tab supports inline status changes via a dropdown per row, an emergency " +
    "cancellation flow that captures a reason which is then surfaced to the client as a modal " +
    "notification on next visit, and an Overstay toggle that blocks the customer from making further " +
    "bookings until the flag is cleared."),

  H2("9.4 System Configuration"),
  P("The Settings tab exposes the four singleton SystemConfig values: refund grace period in hours, " +
    "maximum number of active reservations per user, maximum reservation length in days, and default " +
    "hourly and daily prices used to pre-fill the new-garage form. Changes are persisted via POST to " +
    "/api/garages/system-config/."),

  H2("9.5 Availability Calendar"),
  P("A dedicated calendar modal lets an administrator pick any garage from a drop-down and immediately " +
    "see a full month overview with per-day availability colour-coded as free (white), partial (light red), " +
    "or fully booked (dark red). Clicking any day reveals a 24-cell hourly timeline below the calendar, " +
    "showing exactly which hours are busy. This view is read-only and is intended for quick capacity " +
    "checks."),
);

// ════════════════════════════════════════════════════════════
//  10. AUTHENTICATION & SECURITY
// ════════════════════════════════════════════════════════════
content.push(
  H1("10. Authentication and Security"),

  H2("10.1 Registration and Email Verification"),
  P("RegisterView.vue collects username, email, phone number, optional first and last name, password " +
    "and password confirmation. The submission is sent to POST /api/accounts/register/. The serializer " +
    "validates phone-number presence and password length; the view creates the user with is_active=False " +
    "and email_verified=False, then sends a verification email containing a tokenised link of the form:"),
  CODE("http://localhost:5173/verify/<uid>/<token>"),
  P("When the user clicks the link, VerifyView.vue extracts the parameters and calls " +
    "GET /api/accounts/verify/<uid>/<token>/. The backend verifies the token using Django's " +
    "default_token_generator and flips email_verified and is_active to True."),
  P("If real SMTP is unavailable (for instance during a demo without internet), the email backend falls " +
    "back to Django's console backend and the link is also printed prominently to the Django terminal as " +
    "a safety net."),

  H2("10.2 Google OAuth"),
  P("django-allauth handles the OAuth dance. The user clicks Sign in with Google on the login form, " +
    "which redirects to /accounts/google/login/. Allauth handles the redirect to Google, the consent " +
    "screen, and the callback. After a successful sign-in the user is redirected to the custom view " +
    "social_login_success defined in accounts/views.py, which:"),
  BULLET("Ensures the user has a sensible username (deriving one from the email's local part if " +
    "allauth left it empty, with collision handling)."),
  BULLET("Generates a DRF Token using the standard get_or_create idiom."),
  BULLET("Redirects to http://localhost:5173/auth-callback?token=<key>, passing the token in the URL."),
  P("AuthCallback.vue stores the token and then fetches /api/accounts/profile/ to retrieve the username " +
    "and role, which it persists in localStorage. The user lands on the home page with the navigation " +
    "bar correctly showing their name."),

  H2("10.3 Role-Based Access Control"),
  P("Two roles are defined on the User model: client and admin. Permissions are enforced at the DRF " +
    "viewset level using IsAuthenticated and a custom IsSystemAdmin check. The most important " +
    "security property is that the profile-update endpoint silently ignores any role field submitted " +
    "in the request body, preventing a malicious client from promoting themselves to admin. A unit test " +
    "(test_security_prevent_role_change in accounts/tests.py) asserts this behaviour."),

  H2("10.4 Secrets Management"),
  P("All sensitive values live in a gitignored .env.local file at the project root. The file is loaded " +
    "at startup by settings.py, create_db.py, and seed.py through python-dotenv. A committed " +
    ".env.example file documents the required keys with placeholder values."),
  P("The complete set of secrets is:"),
  BULLET("SECRET_KEY — Django cryptographic key."),
  BULLET("DEBUG — runtime mode."),
  BULLET("DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT — PostgreSQL connection."),
  BULLET("FRONTEND_URL — origin used for OAuth callbacks and verification emails."),
  BULLET("STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY — Stripe API credentials."),
  BULLET("EMAIL_HOST_USER, EMAIL_HOST_PASSWORD — Gmail SMTP."),
  BULLET("GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_SECRET — used by seed.py to provision the SocialApp row."),

  H2("10.5 Payment Security"),
  P("Stripe Elements is mounted inside the SPA and exchanges card data directly with Stripe's servers " +
    "over TLS. The application backend never sees the full card number, only Stripe's PaymentIntent " +
    "identifier. This places the deployment outside the strictest PCI DSS scope (SAQ-A)."),
);

// ════════════════════════════════════════════════════════════
//  11. PAYMENT SYSTEM
// ════════════════════════════════════════════════════════════
content.push(
  H1("11. Payment System"),

  H2("11.1 Payment Intent Creation"),
  P("After a reservation is created with status pending, the SPA immediately calls " +
    "POST /api/create-payment-intent/<reservation_id>/. The view verifies that the request user owns " +
    "the reservation, checks that the 15-minute hold has not yet expired, then invokes Stripe with " +
    "the calculated total (rounded to the cent and converted to integer minor units, as Stripe requires)."),
  CODE("intent = stripe.PaymentIntent.create(\n    amount=int(reservation.total_price * 100),\n    currency='eur',\n    metadata={'reservation_id': reservation.id},\n    automatic_payment_methods={'enabled': True},\n)"),
  P("The clientSecret returned by Stripe is sent back to the SPA, which uses it to confirm the payment " +
    "on the client side. After the user submits the card form, the SPA calls /api/garages/save-payment/ " +
    "with the PaymentIntent identifier. The view writes a Payment row and marks the reservation " +
    "confirmed; an idempotency check (filter on stripe_charge_id) prevents duplicate Payment rows if " +
    "the request is replayed."),

  H2("11.2 Fifteen-Minute Hold"),
  P("Pending reservations are valid for fifteen minutes from creation. A helper function " +
    "clean_expired_reservations is invoked at the top of every reservation list query and marks any " +
    "row older than that as cancelled, freeing the slot for other users. A floating countdown timer in " +
    "GlobalPaymentTimer.vue keeps the user aware of the remaining time."),

  H2("11.3 Refunds"),
  P("Emergency cancellation logic lives in ReservationViewSet.emergency_cancel. If more than twenty-four " +
    "hours remain before the reservation start, the view iterates through the associated Payment rows " +
    "and calls stripe.Refund.create for each. Each successful refund flips the is_refunded flag on the " +
    "Payment row. A composite message is returned to the client describing the outcome. Within the " +
    "24-hour window cancellation is allowed but no refund is issued."),

  H2("11.4 Extensions"),
  P("A confirmed reservation can be extended either by N hours or by a full day. The extension flow is " +
    "two-step:"),
  BULLET("POST /reservations/<id>/initiate_extension/ with the proposed new end time. The view checks " +
    "for conflicts in the extended window, calculates the additional cost at the per-hour rate, creates " +
    "a new Stripe PaymentIntent, and returns its clientSecret."),
  BULLET("POST /reservations/<id>/confirm_extension/ once the payment is confirmed. The view updates " +
    "the reservation's end_time, adds the additional cost to total_price, and writes a second Payment " +
    "row."),
);

// ════════════════════════════════════════════════════════════
//  12. ANALYTICS & MACHINE LEARNING
// ════════════════════════════════════════════════════════════
content.push(
  H1("12. Analytics and Machine Learning"),

  H2("12.1 Analytics Dashboard"),
  P("AnalyticsPanel.vue presents three visualisations on a single screen:"),
  BULLET("A revenue-over-time line chart, rendered with Chart.js, summarising the sum of total_price " +
    "for confirmed and completed reservations grouped by day."),
  BULLET("A top-ten popularity ranking, rendered as a doughnut chart, counting reservations per garage."),
  BULLET("A weekday × hour occupancy heatmap, rendered as a 7×24 grid of coloured cells. Each cell shows " +
    "the count of reservations whose time window overlaps that weekday and hour."),
  P("All three are driven by a single endpoint GET /api/garages/analytics-data/, which accepts optional " +
    "start_date, end_date and equipment_id query parameters. The same endpoint also has a POST variant " +
    "accepting an uploaded CSV (analyze-csv) so the dashboard can be re-rendered against an external " +
    "dataset."),

  H2("12.2 Apriori Association Rules"),
  P("The first machine-learning module mines association rules from historical reservation data using " +
    "the Apriori algorithm provided by mlxtend. Each historical reservation is encoded as a transaction " +
    "of binary features describing:"),
  BULLET("Whether the booking was longer than four hours."),
  BULLET("Whether the booking fell on a weekend."),
  BULLET("Which equipment items the garage had (one feature per equipment row)."),
  P("Apriori extracts frequent itemsets, from which association rules with confidence and lift metrics " +
    "are generated. The view filters down to rules whose consequent involves the duration or weekend " +
    "features, classifies them by strength (Certain ≥ 80 %, High ≥ 50 %, Moderate below), and returns " +
    "a structured response that the SPA renders as a sortable, paginated list of natural-language rules."),
  P("Example rule discovered in the seeded data:"),
  CODE("When a garage has [Two-post Lift], there is an 80% chance for: Reservation over 4h."),
  P("Apriori operates either over the live database (GET) or over an uploaded CSV file (POST), which " +
    "enables sandbox-mode comparisons without database mutations."),

  H2("12.3 Decision Tree — Churn Prediction"),
  P("The second machine-learning module trains a DecisionTreeClassifier from scikit-learn to predict " +
    "whether a reservation will succeed (confirmed or completed) or be cancelled. The feature matrix " +
    "uses day of week, start hour, and a one-hot encoding of every equipment item. The trained tree is " +
    "rendered to PNG using matplotlib's plot_tree, with custom annotations to make the splits readable " +
    "(for instance, “Hour ≤ 17.5?” becomes “Before 17:30?”, equipment columns become “Has: Two-post Lift?”)."),
  P("The PNG is encoded as a base64 data URI and returned in JSON, which the SPA embeds directly in an " +
    "<img> tag. The training set can also be exported to CSV via GET /export-decision-tree/."),

  H2("12.4 Sandbox Mode"),
  P("Both machine-learning modules and the analytics dashboard accept an uploaded CSV instead of " +
    "reading from the database. When the SPA detects that the most recent response came from an " +
    "uploaded file, it shows a prominent amber banner reading Preview / Simulation Mode at the top of " +
    "the screen, alongside a Back to Database button. This mode is intended for safe demos, what-if " +
    "analyses, and comparing historical periods by uploading exported snapshots."),
);

// ════════════════════════════════════════════════════════════
//  13. TESTING
// ════════════════════════════════════════════════════════════
content.push(
  H1("13. Testing"),

  H2("13.1 Test Suite Overview"),
  P("The project ships seventeen automated unit tests organised across two Django apps. The suite runs " +
    "in under fifteen seconds against a fresh test database (a private database that Django creates and " +
    "drops automatically) and is executed via Django's standard test runner."),

  H2("13.2 Coverage"),
  P("Tests in accounts/tests.py cover:"),
  BULLET("User model creation and password hashing."),
  BULLET("__str__ representation."),
  BULLET("User serializer rejects requests missing the phone_number field."),
  BULLET("User serializer creates a user with hashed password."),
  BULLET("Profile update endpoint silently ignores role changes (privilege escalation guard)."),
  BULLET("Registration endpoint returns 201 and creates an inactive user."),
  BULLET("Login endpoint returns a token, role, username, and email."),
  BULLET("Authenticated profile retrieval returns the current user."),
  BULLET("Unauthenticated profile retrieval returns 401."),
  P("Tests in garages/tests.py cover:"),
  BULLET("Garage model field persistence."),
  BULLET("Many-to-many relationship with Equipment."),
  BULLET("Hourly pricing calculation."),
  BULLET("Reservation overlap detection (cannot double-book)."),
  BULLET("Past-date reservations are rejected."),
  BULLET("Unauthenticated users cannot create reservations."),
  BULLET("Authenticated users can create reservations."),
  BULLET("Garage list endpoint is publicly accessible."),

  H2("13.3 Running Tests"),
  P("The dedicated testowanie.bat script activates the virtual environment, executes the test suite " +
    "for accounts and garages separately, and produces a colour-coded final report. Direct invocation " +
    "of the Django runner is also supported:"),
  CODE("venv\\Scripts\\python.exe manage.py test accounts garages"),
);

// ════════════════════════════════════════════════════════════
//  14. INSTALLATION & DEPLOYMENT
// ════════════════════════════════════════════════════════════
content.push(
  H1("14. Installation and Deployment"),

  H2("14.1 Requirements"),
  BULLET("Python 3.13 or newer, added to PATH."),
  BULLET("Node.js 20.19 or newer (or 22.12+)."),
  BULLET("PostgreSQL 14 or newer, listening on 127.0.0.1:5432 with credentials that match the .env.local file."),

  H2("14.2 Quick Start"),
  P("All bootstrap logic lives in a single Windows batch script. After populating .env.local from " +
    ".env.example, the user simply double-clicks install-and-run.bat. The script performs:"),
  BULLET("Verifies that Python and Node are on PATH."),
  BULLET("Creates a Python virtual environment in ./venv if missing, installs Python dependencies."),
  BULLET("Drops and recreates the PostgreSQL database via create_db.py."),
  BULLET("Deletes existing migration files (excluding __init__.py) and regenerates them from current models."),
  BULLET("Applies migrations to the new database."),
  BULLET("Runs seed.py, which populates one admin user, ten clients, twenty garages with downloaded " +
    "photographs, around 1,500 historical reservations with intentional ML-friendly patterns, and the " +
    "Google OAuth SocialApp row."),
  BULLET("Installs frontend dependencies (npm install) and starts the Vite dev server in a new window."),
  BULLET("Starts the Django dev server in another new window and opens the browser on the frontend URL."),

  H2("14.3 Configuration via .env.local"),
  P("Every secret and environment-specific value lives in a single .env.local file at the project root. " +
    "Three Python entry points load it at startup through python-dotenv: settings.py, create_db.py, and " +
    "seed.py. A committed .env.example file documents every required key with a placeholder value."),

  H2("14.4 Project Reset"),
  P("Re-running install-and-run.bat performs a full reset: the database is dropped and recreated, " +
    "migrations are regenerated, seeded data is rebuilt. All previously created reservations are lost. " +
    "This destructive behaviour is intentional and is the recommended way to recover from any data " +
    "inconsistency during development."),
);

// ════════════════════════════════════════════════════════════
//  15. PROJECT STRUCTURE
// ════════════════════════════════════════════════════════════
content.push(
  H1("15. Project Structure"),
  P("A simplified view of the repository layout:"),
  CODE(
    "GarageOnDemand/\n" +
    "├─ accounts/                # Django app: users, authentication\n" +
    "│  ├─ models.py             # Custom User with role and email_verified\n" +
    "│  ├─ serializers.py        # UserSerializer with role-update guard\n" +
    "│  ├─ views.py              # Login, register, profile, Google OAuth bridge\n" +
    "│  ├─ urls.py               # Routes prefixed with /api/accounts/\n" +
    "│  └─ tests.py              # 9 unit tests\n" +
    "├─ garages/                 # Django app: catalogue, reservations, ML\n" +
    "│  ├─ models.py             # Garage, Equipment, Reservation, Payment, SystemConfig\n" +
    "│  ├─ serializers.py        # ReservationSerializer with validation logic\n" +
    "│  ├─ views.py              # 1200+ LOC: CRUD, payments, ML, analytics\n" +
    "│  ├─ urls.py               # Routes prefixed with /api/garages/\n" +
    "│  └─ tests.py              # 8 unit tests\n" +
    "├─ backend/                 # Django project config\n" +
    "│  ├─ settings.py           # Loads .env.local, configures DB, email, etc.\n" +
    "│  ├─ urls.py               # Root URL conf\n" +
    "│  └─ permissions.py        # IsSystemAdmin custom permission\n" +
    "├─ frontend/                # Vue 3 SPA\n" +
    "│  ├─ src/views/            # Top-level routes (Home, Offer, Reservation, ...)\n" +
    "│  ├─ src/components/       # Shared widgets (GlobalPaymentTimer)\n" +
    "│  ├─ src/api/index.js      # Axios instance with Token interceptor\n" +
    "│  ├─ src/router/index.js   # Vue Router config\n" +
    "│  └─ src/assets/main.css   # Tailwind directives and design overrides\n" +
    "├─ presentation/            # PowerPoint deck and this documentation\n" +
    "├─ install-and-run.bat      # Bootstrap script\n" +
    "├─ testowanie.bat           # Test runner\n" +
    "├─ create_db.py             # Drops and recreates the database\n" +
    "├─ seed.py                  # Generates demo data\n" +
    "├─ manage.py                # Django entry point\n" +
    "├─ requirements.txt         # Python dependencies\n" +
    "├─ .env.example             # Template for .env.local (committed)\n" +
    "└─ .env.local               # Secrets (gitignored)"
  ),
);

// ════════════════════════════════════════════════════════════
//  16. FUTURE WORK
// ════════════════════════════════════════════════════════════
content.push(
  H1("16. Future Work"),
  P("Several extensions are deliberately out of scope for the final-year submission but would be " +
    "natural next steps for a real deployment:"),
  BULLET("Multi-tenancy — support multiple workshop operators on the same instance, each managing " +
    "their own catalogue."),
  BULLET("Webhook-driven payment confirmation — replace the optimistic save-payment endpoint with a " +
    "Stripe webhook for stronger consistency guarantees."),
  BULLET("Production deployment — replace the Django and Vite dev servers with Gunicorn behind Nginx, " +
    "containerise the stack with Docker Compose, and provision the database on a managed service."),
  BULLET("Email queueing — push email sending to a Celery worker so request latency does not depend " +
    "on the SMTP server response time."),
  BULLET("Comprehensive end-to-end tests — add Playwright tests for the SPA covering the discover → " +
    "book → pay flow."),
  BULLET("Mobile-native applications — the API is ready; a React Native or Flutter client could " +
    "consume the same endpoints."),
  BULLET("Real-time admin notifications — push reservation events to admins via WebSockets " +
    "(django-channels) for an immediate operational dashboard."),
);

// ════════════════════════════════════════════════════════════
//  17. CONCLUSION
// ════════════════════════════════════════════════════════════
content.push(
  H1("17. Conclusion"),
  P("Garage OnDemand demonstrates the design and implementation of a full-stack web application that " +
    "spans modern frontend tooling, a robust backend API, an integrated payment provider, two distinct " +
    "machine-learning techniques, an administrative interface, and a deployment workflow. The project " +
    "satisfies the goals set at the outset: the end-user can complete the discovery, reservation, " +
    "payment and access flow in well under a minute; the operator has full administrative control plus " +
    "actionable business insight; and the codebase is testable, documented, and maintainable."),
  P("Working as a group of three, we divided responsibility across the frontend, the backend API, and " +
    "the data-science modules while collaborating on the cross-cutting concerns of authentication, " +
    "deployment, and documentation. The result is a deployable proof-of-concept that we believe could, " +
    "with the production-readiness work described in Section 16, support a real micro-operator running " +
    "a small workshop business."),
);

// ════════════════════════════════════════════════════════════
//  18. REFERENCES
// ════════════════════════════════════════════════════════════
content.push(
  H1("18. References"),
  BULLET("Django documentation — https://docs.djangoproject.com/"),
  BULLET("Django REST Framework — https://www.django-rest-framework.org/"),
  BULLET("Vue.js Guide — https://vuejs.org/guide/"),
  BULLET("Vite — https://vitejs.dev/"),
  BULLET("Tailwind CSS — https://tailwindcss.com/docs"),
  BULLET("Stripe API reference — https://stripe.com/docs/api"),
  BULLET("scikit-learn user guide — https://scikit-learn.org/stable/user_guide.html"),
  BULLET("mlxtend documentation — https://rasbt.github.io/mlxtend/"),
  BULLET("django-allauth — https://docs.allauth.org/"),
  BULLET("PostgreSQL documentation — https://www.postgresql.org/docs/"),
);

// ════════════════════════════════════════════════════════════
//  ASSEMBLE DOCUMENT
// ════════════════════════════════════════════════════════════
const doc = new Document({
  creator: "Bartłomiej, Michał, Oscar",
  title: "Garage OnDemand — Technical Documentation",
  description: "Final-year project documentation",
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22, color: C.text } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 40, bold: true, font: "Cambria", color: C.dark },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Cambria", color: C.primary },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Cambria", color: C.text },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({
            text: "Garage OnDemand — Technical Documentation",
            font: "Calibri", size: 18, color: C.muted, italics: true,
          })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", font: "Calibri", size: 18, color: C.muted }),
            new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: C.muted }),
            new TextRun({ text: " of ", font: "Calibri", size: 18, color: C.muted }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 18, color: C.muted }),
          ],
        })],
      }),
    },
    children: content,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("GarageOnDemand-Documentation.docx", buf);
  console.log("✓ Wrote GarageOnDemand-Documentation.docx");
});
