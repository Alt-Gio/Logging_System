const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageBreak, UnderlineType, Header, Footer,
  TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

const BLUE = '0038A8';
const RED = 'CE1126';
const LIGHT_BLUE = 'EEF3FF';
const DARK = '1A1A2E';
const MID = '555577';
const GRAY_BG = 'F5F7FA';
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function h(text, level = 1) {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 400 : 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: level === 1 ? BLUE : DARK, size: level === 1 ? 32 : level === 2 ? 26 : 22 })]
  });
}

function p(text, options = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, color: MID, size: 20, ...options })]
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 360 },
    children: [new TextRun({
      text,
      font: 'Courier New',
      size: 18,
      color: '1a1a2e',
    })]
  });
}

function tip(text, color = LIGHT_BLUE, textColor = BLUE) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    indent: { left: 360, right: 360 },
    children: [new TextRun({ text, color: textColor, size: 19, italics: true })]
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 1 } },
    children: []
  });
}

function step(num, title, description) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [720, 8640],
    margins: { top: 80, bottom: 80 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            width: { size: 720, type: WidthType.DXA },
            shading: { fill: BLUE, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: 'center',
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(num), bold: true, color: 'FFFFFF', size: 24 })]
            })]
          }),
          new TableCell({
            borders: NO_BORDERS,
            width: { size: 8640, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 200, right: 80 },
            children: [
              new Paragraph({ children: [new TextRun({ text: title, bold: true, color: DARK, size: 22 })] }),
              new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: description, color: MID, size: 19 })] }),
            ]
          })
        ]
      })
    ]
  });
}

function infoBox(title, lines) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [new TableCell({
          borders: BORDERS,
          width: { size: 9360, type: WidthType.DXA },
          shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [
            new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: title, bold: true, color: BLUE, size: 20 })] }),
            ...lines.map(l => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: l, color: MID, font: 'Courier New', size: 18 })] }))
          ]
        })]
      })
    ]
  });
}

function sp(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ spacing: { after: 0 }, children: [] }));
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Calibri', color: BLUE },
        paragraph: { spacing: { before: 400, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Calibri', color: DARK },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Calibri', color: DARK },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE, space: 1 } },
          children: [
            new TextRun({ text: 'DICT Region V – DTC Computer Logging System', bold: true, color: BLUE, size: 20 }),
            new TextRun({ text: '   |   Installation & Setup Guide', color: MID, size: 18 }),
          ]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: BLUE, space: 1 } },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: '© 2026 DICT Region V – Digital Transformation Center  ', color: MID, size: 16 }),
            new TextRun({ text: '\tPage N', color: MID, size: 16 }),
          ]
        })]
      })
    },
    children: [
      // ===== COVER =====
      new Paragraph({
        spacing: { before: 1440, after: 0 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'DICT REGION V', bold: true, color: BLUE, size: 56, font: 'Calibri' })]
      }),
      new Paragraph({
        spacing: { before: 0, after: 60 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Digital Transformation Center – Bicol', color: MID, size: 26 })]
      }),
      divider(),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Computer Logging System', bold: true, color: DARK, size: 42 })]
      }),
      new Paragraph({
        spacing: { after: 400 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Installation, Setup & Deployment Guide', color: MID, size: 24, italics: true })]
      }),
      new Table({
        width: { size: 6000, type: WidthType.DXA },
        alignment: AlignmentType.CENTER,
        columnWidths: [2000, 2000, 2000],
        rows: [new TableRow({ children: [
          ...[['Stack', 'Next.js 14 + TypeScript'], ['Database', 'PostgreSQL (Railway)'], ['Deploy', 'Railway.app']].map(([k, v]) =>
            new TableCell({
              borders: NO_BORDERS,
              width: { size: 2000, type: WidthType.DXA },
              shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: k, bold: true, color: BLUE, size: 18 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v, color: MID, size: 17 })] }),
              ]
            })
          )
        ]})]
      }),
      ...sp(2),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'Version 1.0   •   March 2026', color: MID, size: 18, italics: true })]
      }),

      // ===== PAGE BREAK =====
      new Paragraph({ children: [new PageBreak()] }),

      // ===== SECTION 1 =====
      h('1. System Overview'),
      p('The DTC Computer Logging System is a full-stack web application that replaces paper-based client logbooks at the DICT Region V Digital Transformation Center. It allows walk-in clients to log their name, agency, purpose, and ICT equipment used, while giving staff a real-time dashboard to monitor active users, PC statuses, and usage statistics.'),
      ...sp(1),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3000, 6360],
        rows: [
          ...[
            ['Feature', 'Description', true],
            ['Client Logbook', 'Walk-in entry form with live clock, equipment selection, PC assignment', false],
            ['Auto Time In/Out', 'Automatic timestamps on entry; staff checks out clients via admin panel', false],
            ['PC Status Tracking', 'Visual grid showing which workstations are Online, In Use, or Offline', false],
            ['Network Scanner', 'Pings LAN range to detect which PCs are online in real time', false],
            ['Admin Dashboard', 'Stats, recent entries, weekly chart, and workstation management', false],
            ['Railway Deployment', 'One-click cloud deployment with PostgreSQL database included', false],
          ].map(([k, v, isHeader]) => new TableRow({
            tableHeader: !!isHeader,
            children: [
              new TableCell({
                borders: BORDERS,
                width: { size: 3000, type: WidthType.DXA },
                shading: { fill: isHeader ? BLUE : GRAY_BG, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: k, bold: !!isHeader, color: isHeader ? 'FFFFFF' : DARK, size: 19 })] })]
              }),
              new TableCell({
                borders: BORDERS,
                width: { size: 6360, type: WidthType.DXA },
                shading: { fill: isHeader ? BLUE : 'FFFFFF', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: v, color: isHeader ? 'FFFFFF' : MID, size: 19 })] })]
              }),
            ]
          }))
        ]
      }),

      // ===== SECTION 2 =====
      h('2. Prerequisites'),
      p('Install the following tools on your development machine before starting:'),
      ...sp(1),

      ...['Node.js v18 or higher — https://nodejs.org (LTS version)', 'Git — https://git-scm.com', 'VS Code (recommended) — https://code.visualstudio.com', 'Railway CLI (optional, for deploy from terminal) — https://railway.app'].map(t =>
        new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, color: MID, size: 20 })] })
      ),
      ...sp(1),
      tip('💡 You do NOT need to install PostgreSQL locally. Railway provides a cloud database for free.'),

      // ===== SECTION 3 =====
      h('3. Project Setup'),
      h('3.1 Clone and Install', 2),
      p('Open your terminal and run the following commands:'),
      ...sp(1),
      infoBox('Terminal Commands', [
        '# 1. Clone the repository (or unzip the project folder)',
        'git clone https://github.com/your-username/dict-logbook.git',
        'cd dict-logbook',
        '',
        '# 2. Install all dependencies',
        'npm install',
      ]),
      ...sp(1),

      h('3.2 Environment Variables', 2),
      p('Copy the example environment file and fill in your values:'),
      ...sp(1),
      infoBox('Setup .env.local', [
        '# Copy the example file',
        'cp .env.example .env.local',
        '',
        '# Open .env.local and set your DATABASE_URL from Railway',
        '# (see Section 4 for how to get the database URL)',
      ]),
      ...sp(1),
      p('The .env.local file should look like this:'),
      ...sp(1),
      infoBox('.env.local contents', [
        'DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"',
        'JWT_SECRET="your-random-secret-string-here"',
        'NODE_ENV="development"',
      ]),
      ...sp(1),
      tip('⚠️  Never commit .env.local to Git. It is already in .gitignore for your safety.'),

      // ===== SECTION 4 =====
      h('4. Database Setup (Railway PostgreSQL)'),
      ...sp(1),

      ...([
        [1, 'Create a Railway account', 'Go to https://railway.app and sign up with your GitHub account. The Hobby plan is free and sufficient for DICT use.'],
        [2, 'Create a new project', 'Click "New Project" → "Provision PostgreSQL". Railway will create a cloud database in seconds.'],
        [3, 'Get your DATABASE_URL', 'Click on the PostgreSQL service → "Connect" tab → copy the "DATABASE_URL" value. Paste it into your .env.local file.'],
        [4, 'Push the database schema', 'Run this command in your terminal to create all the tables:'],
        [5, 'Seed default data', 'Create the default admin account and 8 workstation slots:'],
      ].map(([n, t, d]) => [step(n, t, d), ...sp(1)]).flat()),

      infoBox('Schema & Seed Commands', [
        '# Push schema to Railway database (creates all tables)',
        'npx prisma db push',
        '',
        '# Seed default admin and PC stations',
        'npm run db:seed',
        '',
        '# Optional: Open Prisma Studio to browse your database',
        'npm run db:studio',
      ]),
      ...sp(1),
      tip('✅ Default admin credentials: username = admin  |  password = dict2026!  — Change this immediately after first login.'),

      // ===== SECTION 5 =====
      h('5. Running Locally'),
      p('Start the development server:'),
      ...sp(1),
      infoBox('Start dev server', [
        'npm run dev',
        '',
        '# The app will be available at:',
        'http://localhost:3000        ← Client logbook form',
        'http://localhost:3000/admin  ← Staff admin panel',
      ]),
      ...sp(1),
      tip('💡 The development server supports hot reload — changes you make to the code will appear instantly without restarting.'),

      // ===== SECTION 6 =====
      h('6. Deploying to Railway'),
      ...sp(1),

      ...([
        [1, 'Push your code to GitHub', 'Create a new GitHub repository and push your project code. Railway will automatically deploy from GitHub.'],
        [2, 'Connect GitHub to Railway', 'In Railway, click "New Project" → "Deploy from GitHub" → select your repository.'],
        [3, 'Add environment variables', 'In Railway → your service → "Variables" tab, add: DATABASE_URL (from Step 4) and JWT_SECRET (any random string).'],
        [4, 'Deploy', 'Railway will automatically build and deploy your app. The build command runs: prisma generate && next build'],
        [5, 'Get your public URL', 'In Railway → your service → "Settings" → "Domains" → Generate domain. You will get a URL like: dict-logbook.up.railway.app'],
      ].map(([n, t, d]) => [step(n, t, d), ...sp(1)]).flat()),

      infoBox('Railway Build Settings (auto-detected)', [
        'Build Command:   npm run build',
        'Start Command:   npm start',
        'Health Check:    /api/stats',
        '',
        '# These are set automatically via railway.toml in the project root',
      ]),

      // ===== SECTION 7 =====
      h('7. Network PC Scanner Setup'),
      p('The network scanner pings your LAN to detect which PCs are online. Since the scanner runs on the Railway server, it needs to be on the same network as your PCs, OR you can run the app locally and expose it via a reverse proxy.'),
      ...sp(1),

      h('Option A: Local Deployment (Recommended for LAN scanning)', 2),
      p('Run the app locally on a computer that is connected to the DTC LAN. Use the Railway database but keep the Next.js server on your local network.'),
      ...sp(1),
      infoBox('Run locally with Railway database', [
        '# .env.local — use Railway DATABASE_URL but run locally',
        'DATABASE_URL="postgresql://..." ← from Railway',
        'NODE_ENV="production"',
        '',
        '# Start in production mode',
        'npm run build && npm start',
        '',
        '# Access from any PC on the network:',
        'http://YOUR_LOCAL_IP:3000',
        '',
        '# Find your local IP (run in terminal):',
        'ipconfig   ← Windows',
        'ip addr    ← Linux',
      ]),
      ...sp(1),

      h('Option B: Railway Deployment with Fixed PC IPs', 2),
      p('Deploy to Railway for external access. The network scanner will show "offline" for all PCs (since Railway cannot reach your LAN), but you can manually mark PCs and use the logbook normally. PC status can be updated manually from the Workstations tab.'),
      ...sp(1),
      tip('💡 For best results in DICT Donsol: run the app on a local server (e.g., your existing Proxmox/pfSense machine) with DATABASE_URL pointing to Railway. This gives you LAN scanning + cloud database backup.'),

      // ===== SECTION 8 =====
      h('8. Configuring PC Stations'),
      p('After setup, add your physical PC stations in the Admin panel:'),
      ...sp(1),
      ...([
        '1. Go to http://localhost:3000/admin and log in',
        '2. Click "Workstations" tab',
        '3. Enter the PC Name (e.g. PC-01), IP Address (e.g. 192.168.1.101), and Location (e.g. Station A)',
        '4. Click "Add" to register the station',
        '5. Use "Network Scan" tab to verify PCs are responding to pings',
      ].map(t => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: t, color: MID, size: 20 })] }))),
      ...sp(1),
      infoBox('Default PC IP Range (edit in seed.ts)', [
        'PC-01 → 192.168.1.101',
        'PC-02 → 192.168.1.102',
        '...and so on up to PC-08 → 192.168.1.108',
        '',
        '# Adjust these to match your actual DICT LAN IP range',
        '# Then re-run: npm run db:seed',
      ]),

      // ===== SECTION 9 =====
      h('9. Admin Credentials & Security'),
      ...sp(1),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2400, 6960],
        rows: [
          ...[
            ['Setting', 'Value / Action', true],
            ['Default Username', 'admin'],
            ['Default Password', 'dict2026!  ← CHANGE THIS'],
            ['Session Duration', '8 hours (auto-logout after 8 hours)'],
            ['Change Password', 'Update in Prisma Studio: npx prisma studio → Admin table → edit'],
            ['Add Staff Account', 'Add row in Admin table via Prisma Studio'],
          ].map(([k, v, isH]) => new TableRow({
            children: [
              new TableCell({ borders: BORDERS, width: { size: 2400, type: WidthType.DXA },
                shading: { fill: isH ? BLUE : GRAY_BG, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: k, bold: !!isH, color: isH ? 'FFFFFF' : DARK, size: 19 })] })] }),
              new TableCell({ borders: BORDERS, width: { size: 6960, type: WidthType.DXA },
                shading: { fill: isH ? BLUE : 'FFFFFF', type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ children: [new TextRun({ text: v, color: isH ? 'FFFFFF' : MID, size: 19 })] })] }),
            ]
          }))
        ]
      }),

      // ===== SECTION 10 =====
      h('10. Troubleshooting'),
      ...sp(1),
      ...([
        ['npm run build fails', 'Run npx prisma generate first, then npm run build. Make sure DATABASE_URL is set in your environment.'],
        ['Database connection error', 'Check that DATABASE_URL in .env.local matches the Railway connection string exactly. Test with: npx prisma db push'],
        ['PCs show as offline after scan', 'The scanner pings from the server. If hosted on Railway, it cannot reach your local LAN. Use local deployment (Option A) for LAN scanning.'],
        ['Cannot log in to admin', 'Run the seed script again: npm run db:seed. Or check in Prisma Studio that the admin record exists.'],
        ['Port 3000 already in use', 'Run: PORT=3001 npm run dev  to use a different port.'],
        ['Railway build fails', 'Check that all required environment variables are set in Railway → your service → Variables.'],
      ].map(([issue, fix]) => [
        new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: issue, bold: true, color: DARK, size: 20 })] }),
        new Paragraph({ spacing: { after: 100 }, indent: { left: 360 }, children: [new TextRun({ text: '→ ' + fix, color: MID, size: 19 })] }),
      ]).flat()),

      // ===== SECTION 11 =====
      h('11. Quick Reference'),
      ...sp(1),
      infoBox('All Commands at a Glance', [
        'npm install              — Install dependencies',
        'npx prisma db push       — Create/update database tables',
        'npm run db:seed          — Seed admin + workstation data',
        'npm run dev              — Start development server',
        'npm run build            — Build for production',
        'npm start                — Start production server',
        'npm run db:studio        — Open Prisma Studio (database browser)',
        '',
        '# URLs',
        'http://localhost:3000        — Client logbook form',
        'http://localhost:3000/admin  — Admin dashboard',
        '',
        '# Railway URLs (after deployment)',
        'https://your-app.up.railway.app        — Client logbook',
        'https://your-app.up.railway.app/admin  — Admin panel',
      ]),

      divider(),
      new Paragraph({
        spacing: { before: 200 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: 'Department of Information and Communications Technology – Region V  |  March 2026',
          color: MID, size: 17, italics: true
        })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/mnt/user-data/outputs/DICT-Logbook-Setup-Guide.docx', buf);
  console.log('Done!');
});
