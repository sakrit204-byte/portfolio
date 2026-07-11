/**
 * Single source of truth for the site. Mirrors sakrit_kafle_cv_freelance.docx.
 * World coordinates are in world-space px; the camera frames the map at load.
 */

export const PROFILE = {
  name: 'Sakrit Kafle',
  roles: ['Freelance Full-Stack Developer', 'Co-Founder, YADverse'],
  location: 'Bhaktapur, Nepal',
  available: 'Available for remote contracts',
  summary:
    'Full-stack developer and co-founder of YADverse — a software studio shipping web apps, AI products, and hosting infrastructure from Kathmandu. I work directly with clients across time zones, owning projects end-to-end: scoping, architecture, build, and live deployment.',
  summaryRest:
    'Alongside the studio, I take select freelance contracts in custom web development, CRM systems, REST API design, and WordPress. Currently in my penultimate year of B.Tech CSE at VIT Vellore; available for remote contracts.',
};

export const CONTACT = {
  phone: '+977 9861054127',
  phoneHref: 'tel:+9779861054127',
  email: 'sakrit.kafle2024@vitstudent.ac.in',
  site: 'sakritkafle.netlify.app',
  siteHref: 'https://sakritkafle.netlify.app',
  github: 'github.com/sakrit204-byte',
  githubHref: 'https://github.com/sakrit204-byte',
  studio: 'yadverse.netlify.app',
  studioHref: 'https://yadverse.netlify.app',
  cvHref: '/sakrit-kafle-cv.pdf',
  cvFile: 'Sakrit-Kafle-CV.pdf',
};

export const STATS = [
  { value: '12+', label: 'products shipped' },
  { value: '3', label: 'countries served' },
  { value: '99.9%', label: 'uptime' },
  { value: '26', label: 'river systems mapped' },
];

/** Explorable map nodes. `study` drives the case-study drawer. */
export const NODES = [
  {
    id: 'home',
    kind: 'home',
    x: 0,
    y: 0,
    label: 'Sakrit Kafle',
    kicker: 'CLUBHOUSE',
    note: 'start here',
    study: {
      title: 'Sakrit Kafle',
      role: 'Freelance Full-Stack Developer',
      org: 'Co-Founder, YADverse',
      period: 'Bhaktapur, Nepal',
      summary: `${PROFILE.summary} ${PROFILE.summaryRest}`,
      bullets: [
        'Owns projects end-to-end: scoping, architecture, build, live deployment.',
        'Works directly with clients across time zones — Nepal, Australia, and beyond.',
        'Deploys and maintains production infrastructure, not just front-ends.',
      ],
      stack: ['Next.js', 'React', 'Node.js', 'FastAPI', 'PostgreSQL', 'Docker'],
      metrics: STATS.slice(0, 3),
    },
  },
  {
    id: 'yadverse',
    kind: 'studio',
    x: -620,
    y: -140,
    label: 'YADverse',
    kicker: 'THE STUDIO',
    note: 'co-founded 2025',
    study: {
      title: 'YADverse',
      role: 'Co-Founder & Full-Stack Developer',
      org: 'YADverse — Software Studio',
      period: 'Jan 2025 – Present',
      location: 'Kathmandu, Nepal',
      link: { label: 'yadverse.netlify.app', href: CONTACT.studioHref },
      summary:
        'YADverse is a product-engineering studio serving clients across Nepal, Australia, and beyond. We design and build web apps, AI-integrated products, and cloud infrastructure — 12+ products shipped across 3 countries at 99.9% uptime.',
      bullets: [
        'Own the frontend and backend architecture for studio client projects from initial scoping through to production deployment.',
        'Operate reverse-proxy hosting on studio-managed infrastructure; deploy services that auto-restart with zero downtime.',
        'Collaborate across a three-founder team (Dikshit Yadav — cloud infrastructure; Aayush Shah) on bid, design, and delivery.',
      ],
      stack: [
        'Next.js',
        'React',
        'Node.js',
        'FastAPI',
        'PostgreSQL',
        'Supabase',
        'Docker',
        'GitHub Actions',
        'WordPress',
        'Tailwind',
      ],
      metrics: [
        { value: '12+', label: 'products shipped' },
        { value: '3', label: 'countries' },
        { value: '99.9%', label: 'uptime' },
      ],
    },
  },
  {
    id: 'brcrn',
    kind: 'gov',
    x: 520,
    y: -160,
    label: 'BRCRN Project',
    kicker: 'GOVERNMENT OF NEPAL',
    note: '26 river systems',
    study: {
      title: 'BRCRN Project',
      role: 'Full-Stack Developer — Government Deployment',
      org: 'Ministry of Agriculture, Forest and Environment · Government of Nepal',
      period: 'May 2026 – July 2026',
      summary:
        '50-day technical internship under Dr. Krishna Bahadur Bhujel and Dr. Bimal Pokhrel. Delivered two production systems for a seven-year GCF/FAO-funded project covering 26 river systems across Nepal.',
      groups: [
        {
          title: 'Plantation Monitoring System',
          bullets: [
            'Designed and built a unified Android field app + web admin portal sharing a single database across the full plantation lifecycle: site prep, implementation, protection, weeding, and casualty replacement.',
            'Loaded baseline data for all 26 river systems with province/district/area/population, species catalogue, and 48 LRP records across three PPMUs (Koshi, Madhesh, Bagmati).',
            "Deployed onto the Project's on-site Government server using a reverse-proxy approach — connecting to the existing database and running as a managed, auto-starting service without disturbing any live systems.",
            'Distributed the field application to field LRPs.',
          ],
        },
        {
          title: 'Churia Knowledge Centre Web Platform',
          bullets: [
            'Built the web-based Churia Knowledge Centre for knowledge contribution, publication, documentation, and dissemination.',
            'Built an AI-driven RAG tool: the administrator configures access keys for various Government ministry data repositories; the tool autonomously locates, fetches, and classifies documents by type (journal, technical report, pamphlet) to keep the Knowledge Centre continuously populated with Chure-specific knowledge.',
          ],
        },
      ],
      stack: ['Android', 'React', 'FastAPI', 'PostgreSQL', 'RAG', 'LangChain', 'Reverse Proxy', 'Linux'],
      metrics: [
        { value: '26', label: 'river systems' },
        { value: '48', label: 'LRP records' },
        { value: '2', label: 'production systems' },
      ],
    },
  },
  {
    id: 'synexis',
    kind: 'product',
    x: -350,
    y: 190,
    label: 'Synexis CRM',
    kicker: 'INDEPENDENT BUILD',
    note: 'zero scaffolding',
    study: {
      title: 'Synexis CRM',
      role: 'Full-Stack Developer',
      org: 'YADverse Studio Work',
      period: 'Independent Build · 2026',
      summary:
        'A complete CRM platform built from scratch — scoped, architected, built, and shipped end-to-end without guided scaffolding. Now part of the YADverse portfolio.',
      bullets: [
        'Built a complete CRM platform from scratch: contact management, deal pipelines, activity logs, and JWT-based authentication.',
        'Designed REST APIs in Node.js/Express with a relational MySQL schema and role-based access control.',
        'Scoped, architected, built, and shipped the product end-to-end without guided scaffolding — now part of the YADverse portfolio.',
      ],
      stack: ['Node.js', 'Express', 'MySQL', 'JWT', 'RBAC', 'REST'],
      metrics: [
        { value: '100%', label: 'built from scratch' },
        { value: 'RBAC', label: 'access control' },
        { value: 'JWT', label: 'authentication' },
      ],
    },
  },
  {
    id: 'fleet',
    kind: 'client',
    x: 740,
    y: 105,
    label: 'YourFleetElite',
    kicker: 'AUSTRALIA · REMOTE',
    note: 'zero downtime',
    study: {
      title: 'YourFleetElite',
      role: 'WordPress Developer',
      org: 'YourFleetElite · Australia',
      period: 'Remote Contract',
      summary:
        'Built and maintained the production WordPress site for an Australian fleet management company, delivered across time zones.',
      bullets: [
        'Built and maintained the production WordPress site for an Australian fleet management company.',
        'Customised themes and integrated plugins; improved page load speed and mobile responsiveness to match client SLA.',
        'Delivered across time zones — zero downtime on all live deployments throughout the engagement.',
      ],
      stack: ['WordPress', 'PHP', 'Theme Customisation', 'Plugin Integration', 'Performance'],
      metrics: [
        { value: '0', label: 'downtime incidents' },
        { value: 'SLA', label: 'met on mobile' },
        { value: '2', label: 'time zones' },
      ],
    },
  },
  {
    id: 'hire',
    kind: 'beacon',
    x: 40,
    y: 235,
    label: 'Hire Me',
    kicker: 'OPEN FOR CONTRACTS',
    note: 'this way →',
    study: {
      title: 'Let’s build something',
      role: 'Available for remote contracts',
      org: 'Freelance · Worldwide',
      period: 'Booking now',
      summary:
        'I take select freelance contracts in custom web development, CRM systems, REST API design, WordPress, and AI/RAG integrations. I scope honestly, build in the open, and deploy it myself.',
      bullets: [
        'Direct line to the developer — no account managers, no handoffs.',
        'Proven across government, startup, and international commercial clients.',
        'I ship to production and keep it running: reverse-proxy hosting, auto-restart services, Linux admin.',
      ],
      stack: ['Discovery call', 'Fixed scope', 'Weekly demos', 'Production handover'],
      cta: true,
    },
  },
];

/**
 * Screenshot gallery, revealed when the player returns to base camp.
 * Drop an image into `public/shots/` and set `src` to its path to fill a slot;
 * a slot with `src: null` renders as an empty frame.
 */
export const GALLERY = [
  { id: 'brcrn-plantation', title: 'Plantation Monitoring System', project: 'BRCRN Project', src: null },
  { id: 'brcrn-churia', title: 'Churia Knowledge Centre', project: 'BRCRN Project', src: null },
  { id: 'synexis', title: 'Synexis CRM', project: 'Independent Build', src: null },
  { id: 'yadverse', title: 'YADverse Studio', project: 'The Studio', src: null },
  { id: 'fleet', title: 'YourFleetElite', project: 'Australia · Remote', src: null },
  { id: 'brcrn-rag', title: 'AI / RAG Document Pipeline', project: 'BRCRN Project', src: null },
];

/** Hand-drawn ink routes between map nodes. */
export const LINKS = [
  ['home', 'yadverse'],
  ['home', 'brcrn'],
  ['home', 'synexis'],
  ['home', 'hire'],
  ['yadverse', 'synexis'],
  ['yadverse', 'fleet'],
  ['brcrn', 'fleet'],
];

/** ADDITIONAL SKILLS, framed as what a client is buying. */
export const SERVICES = [
  {
    title: 'Custom web apps & dashboards',
    desc: 'Bespoke applications and internal dashboards, designed and built to fit how your team actually works.',
    stack: 'React + Node/FastAPI + PostgreSQL',
    glyph: 'M4 18h16M4 13h10M4 8h6',
  },
  {
    title: 'CRM & internal tools',
    desc: 'Contact management, deal pipelines, and activity tracking with role-based access built in from day one.',
    stack: 'Role-based access · pipelines · activity tracking',
    glyph: 'M5 19V7l7-4 7 4v12M9 19v-6h6v6',
  },
  {
    title: 'WordPress sites',
    desc: 'Production WordPress that stays fast — custom themes, integrated plugins, and real performance tuning.',
    stack: 'Theme customisation · plugin integration · performance tuning',
    glyph: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 4 3 14 0 18',
  },
  {
    title: 'REST API design & integration',
    desc: 'Clean, documented APIs that other systems can actually consume — and integrations into the ones you already run.',
    stack: 'Node/Express · FastAPI · JWT · RBAC',
    glyph: 'M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16',
  },
  {
    title: 'AI / RAG integrations',
    desc: 'Document ingestion pipelines and knowledge bases that find, classify, and surface your own data.',
    stack: 'LangChain · LlamaIndex · Chroma · Pinecone',
    glyph: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l3 3m6 6l3 3m0-12l-3 3m-6 6l-3 3',
  },
  {
    title: 'Server deployment & hosting',
    desc: 'I ship it to production and keep it alive: reverse-proxy hosting, auto-start services, Linux administration.',
    stack: 'Docker · GitHub Actions · reverse proxy · Linux admin',
    glyph: 'M4 6h16v5H4zM4 13h16v5H4zM7 8.5h.01M7 15.5h.01',
  },
];

export const SKILLS = [
  { group: 'Languages', items: ['JavaScript', 'Python', 'HTML5', 'CSS3', 'C'] },
  { group: 'Frontend', items: ['React.js', 'Next.js', 'Tailwind CSS', 'Flexbox', 'Grid', 'DOM Manipulation'] },
  { group: 'Backend', items: ['Node.js', 'Express', 'FastAPI', 'REST APIs', 'JWT auth', 'RBAC'] },
  { group: 'Databases', items: ['MySQL', 'PostgreSQL', 'Supabase', 'Prisma'] },
  { group: 'DevOps', items: ['Docker', 'GitHub Actions', 'CI/CD', 'Reverse-Proxy Hosting', 'Linux Server Admin'] },
  { group: 'CMS', items: ['WordPress', 'Theme customisation', 'Plugin integration', 'Production hosting'] },
  { group: 'AI / RAG', items: ['LangChain', 'LlamaIndex', 'RAG Pipelines', 'Chroma', 'Pinecone'] },
  { group: 'Mobile', items: ['Android (field app deployment)'] },
  { group: 'Tools', items: ['Git', 'Postman', 'Figma', 'Vercel'] },
];

export const EDUCATION = [
  {
    degree: 'B.Tech — Computer Science and Engineering',
    detail: '3rd Year',
    school: 'Vellore Institute of Technology (VIT)',
    place: 'Vellore, Tamil Nadu, India',
    period: '2024 – Present',
  },
  {
    degree: 'Cambridge A Level',
    detail: 'Physics, Mathematics, Computer Science',
    school: 'Little Angels College',
    place: 'Kathmandu, Nepal',
    period: '2021 – 2023',
  },
];

export const REFERENCES = [
  {
    name: 'Kausher Ahmed P',
    title: 'Assistant Professor, VIT Vellore',
    email: 'kauserahmed@vit.ac.in',
    phone: '+91-9942992332',
  },
  {
    name: 'Binod Gyawali',
    title:
      'Planning and Monitoring Officer, BRCRN Project, Ministry of Agriculture, Forest and Environment, Government of Nepal',
  },
];
