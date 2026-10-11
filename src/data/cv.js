/**
 * Single source of truth for the site and the CV. Every claim here should be
 * something Sakrit can point to: a live link, a repo, a screenshot.
 */

export const PROFILE = {
  name: 'Sakrit Kafle',
  role: 'Full stack and AI engineer',
  studio: 'Cofounder, YADverse',
  location: 'Bhaktapur, Nepal',
  headline: 'I design, build and deploy software people rely on.',
  intro:
    'Full stack and AI engineer, cofounder of YADverse. I take products from the first sketch to a running server: web platforms, field apps for government teams, and governed AI tooling.',
  about: [
    'I grew up in Kathmandu and now split my time between client work at YADverse and a B.Tech in Computer Science at VIT Vellore. Most of what I build ends up in production, so I care as much about deployment and maintenance as about the interface.',
    'My favourite projects sit where careful engineering meets real constraints: an app that has to work for forest officers in the field, a CRM an admissions team uses every day, or an AI agent that must not be allowed to do the wrong thing.',
  ],
};

export const CONTACT = {
  phone: '+977 9861054127',
  phoneHref: 'tel:+9779861054127',
  email: 'sakrit.kafle2024@vitstudent.ac.in',
  github: 'github.com/sakrit204-byte',
  githubHref: 'https://github.com/sakrit204-byte',
  youtube: 'youtube.com/@sakritkafle9537',
  youtubeHref: 'https://www.youtube.com/@sakritkafle9537',
  studio: 'yadverse.tech',
  studioHref: 'https://yadverse.tech',
  cvHref: '/sakrit-kafle-cv.pdf',
  cvFile: 'Sakrit-Kafle-CV.pdf',
};

const shot = (p) => `/shots/${p}`;

/**
 * Featured projects, shown as scroll-driven device showcases.
 * `device`: 'monitor' | 'phone' | 'pair' (monitor with a phone in front).
 * Each step swaps the screen; tall screenshots scroll inside the device.
 */
export const PROJECTS = [
  {
    id: 'airlock',
    name: 'Okta Access Airlock',
    context: 'RailCall marketplace module',
    year: '2026',
    device: 'monitor',
    summary:
      'A governed way for AI agents to administer Okta. Every change is previewed, approved by a person and then checked again before it runs, so an agent can help with access reviews without being trusted blindly.',
    stack: ['Python 3.11', 'OAuth 2.0 private_key_jwt', 'DPoP', 'MCP', 'GitHub Actions'],
    links: [
      { label: 'Marketplace listing', href: 'https://railcall.ai/marketplace/sakrit204/okta-access-airlock/' },
      { label: 'Source on GitHub', href: 'https://github.com/sakrit204-byte/Okta_Access_Airlock_Railcall' },
    ],
    video: { id: 'uGARAVYtTCA', label: 'Watch the demo', length: '4:50' },
    steps: [
      {
        tab: 'Publish',
        title: 'Live on the RailCall marketplace',
        text: 'Built for the RailCall Developer Challenge and published as a signed module anyone can install with a single command.',
        web: shot('railcall/railcall_title.jpg'),
      },
      {
        tab: 'Commands',
        title: '36 commands, each with a risk level',
        text: 'Reads and writes are separated. Before a deactivation runs, the module shows its blast radius: what access is removed and what survives. There is deliberately no delete user command.',
        web: shot('railcall/railcall_command_1.jpg'),
      },
      {
        tab: 'Refuse',
        title: 'Plans that refuse to drift',
        text: 'Each plan fingerprints the state it depends on. If the group changes after approval, the apply is refused with plan_drifted instead of acting on stale information.',
        web: shot('railcall/railcall_demo_refused.jpg'),
      },
      {
        tab: 'Prove',
        title: 'Every write has a provable outcome',
        text: 'Writes end as landed, failed or unresolved, and are reconciled against the Okta System Log. A companion workflow runs a quarterly access review end to end.',
        web: shot('railcall/railcall_workflow_listing.jpg'),
      },
    ],
  },
  {
    id: 'plantation',
    name: 'Plantation Monitoring System',
    context: 'BRCRN Project, Government of Nepal',
    year: '2026',
    device: 'pair',
    summary:
      'One system for the whole plantation lifecycle on a GCF and FAO funded climate project: a field app for officers on the ground and an admin portal for the ministry, sharing a single database.',
    stack: ['Flutter (Android)', 'React', 'tRPC', 'PostgreSQL', 'Leaflet', 'Reverse proxy', 'Linux'],
    links: [],
    steps: [
      {
        tab: 'Field',
        title: 'Built for officers in the field',
        text: 'Field officers sign in with their phone number and record site preparation, planting, protection, weeding and casualty replacement, with photos and GPS.',
        web: shot('plantation/web-login.jpg'),
        mobile: shot('plantation/mobile-login.jpg'),
      },
      {
        tab: 'Portal',
        title: 'One portal for the ministry',
        text: 'Administrators see all 26 river systems on a map of Nepal, with role based access, approvals, an audit log and Excel exports for reporting.',
        web: shot('plantation/web-login.jpg'),
        mobile: shot('plantation/mobile-login.jpg'),
      },
      {
        tab: 'Deploy',
        title: 'Running on a government server',
        text: 'Deployed onto the project’s own server behind a reverse proxy as a managed service that starts on its own, without disturbing the systems already running there.',
        web: shot('plantation/web-login.jpg'),
        mobile: shot('plantation/mobile-login.jpg'),
      },
    ],
  },
  {
    id: 'synexis',
    name: 'Synexis CRM',
    context: 'YADverse product',
    year: '2026',
    device: 'monitor',
    summary:
      'A student admissions CRM, built from scratch, that lets a consultancy manage applicants, track every application and keep university preferences in one place.',
    stack: ['Node.js', 'Express', 'MySQL', 'JWT', 'Role based access', 'REST'],
    links: [{ label: 'See it on yadverse.tech', href: 'https://yadverse.tech' }],
    steps: [
      {
        tab: 'Students',
        title: 'A guided four step intake',
        text: 'Counsellors add a student through profile, academic background, application details and documents, so nothing important gets skipped.',
        web: shot('synex/web-add-student.jpg'),
      },
      {
        tab: 'Applications',
        title: 'Visa and university choices together',
        text: 'Each application holds the destination, visa type, intake and course, plus up to four ranked university preferences and an assigned counsellor.',
        web: shot('synex/web-add-student.jpg'),
      },
    ],
  },
  {
    id: 'fleet',
    name: 'YourFleetElite',
    context: 'Remote client, Sydney',
    year: '2025',
    device: 'pair',
    summary:
      'The production WordPress site for a Sydney fleet management company: vans, trucks and utes kept on the road. Built and maintained remotely across time zones.',
    stack: ['WordPress', 'PHP', 'Custom theme', 'Performance tuning'],
    links: [{ label: 'yourfleetelite.com.au', href: 'https://yourfleetelite.com.au/' }],
    steps: [
      {
        tab: 'Site',
        title: 'Clear on a phone, clear on a desk',
        text: 'A customised theme with integrated plugins, tuned for page speed and mobile layout so fleet managers can find what they need quickly.',
        web: shot('yourfleetelite/web-home.jpg'),
        mobile: shot('yourfleetelite/mobile-home.jpg'),
      },
      {
        tab: 'Care',
        title: 'Kept live while it changed',
        text: 'Updates shipped from Nepal on Sydney time, with every deployment made without taking the site down.',
        web: shot('yourfleetelite/web-home.jpg'),
        mobile: shot('yourfleetelite/mobile-home.jpg'),
      },
    ],
  },
  {
    id: 'sakritcraft',
    name: 'SakritCraft',
    context: 'Personal engine project',
    year: 'In progress',
    device: 'monitor',
    still: true,
    summary:
      'A survival and crafting game on a game engine written from scratch in C# and Vulkan. Terrain is a signed distance field, so tunnels slope and cliffs overhang, streamed out to the horizon.',
    stack: ['C#', '.NET 9', 'Vulkan 1.3', 'Surface nets', 'Cascaded shadows'],
    links: [{ label: 'Source on GitHub', href: 'https://github.com/sakrit204-byte/minecraft' }],
    steps: [
      {
        tab: 'World',
        title: 'A world you can see to the horizon',
        text: 'Terrain streams in around the player while the simulation ticks at a steady 20 Hz, independent of frame rate.',
        web: shot('minecraft/12_full_scale_world.jpg'),
      },
      {
        tab: 'Light',
        title: 'Light that reads the landscape',
        text: 'Cascaded shadow maps and raking light give mountains real weight, from noon to dusk.',
        web: shot('minecraft/09_raking_light.jpg'),
      },
      {
        tab: 'Water',
        title: 'Coasts and shorelines',
        text: 'Water meets terrain with a proper shoreline instead of a flat cutoff.',
        web: shot('minecraft/14_shoreline.jpg'),
      },
      {
        tab: 'Night',
        title: 'Creatures after dark',
        text: 'The night pass is where the survival part begins. Mining and crafting are next on the list.',
        web: shot('minecraft/15_creatures_at_night.jpg'),
      },
    ],
  },
];

/** Smaller things worth a look, straight from GitHub. */
export const MORE_WORK = [
  {
    name: 'Churia Knowledge Centre',
    text: 'Knowledge platform for the Ministry of Forests and Environment. Finds Chure research on government sites and classifies it with a local model, with a three reviewer publishing flow and a 3D map of the region.',
    stack: 'Next.js · FastAPI · PostgreSQL · deck.gl · Ollama',
    href: 'https://github.com/sakrit204-byte/churia-knowledge-center',
  },
  {
    name: 'Accent Coach',
    text: 'Speak into the mic and get an accent estimate across 23 classes plus pronunciation and fluency scores, all computed locally on a CPU.',
    stack: 'Python · Whisper · WavLM · FastAPI',
    href: 'https://github.com/sakrit204-byte/accentlearning_ml',
  },
  {
    name: 'Python to C compiler',
    text: 'A deterministic compiler for a subset of Python with a desktop IDE. A local model is consulted only for unknown calls, and its answer is used only if it compiles.',
    stack: 'Python · Lexer, parser, codegen',
    href: 'https://github.com/sakrit204-byte/aibased_language_translation_compiler',
  },
  {
    name: 'Malhotra Enterprise',
    text: 'Catalogue and enquiry platform for an architectural hardware business in Kathmandu, with manager and customer conversations mirrored over email.',
    stack: 'Next.js · Prisma · PostgreSQL · Docker',
    href: 'https://github.com/sakrit204-byte/malhotra_hardware',
  },
];

export const EXPERIENCE = [
  {
    role: 'Cofounder and engineer',
    org: 'YADverse',
    href: 'https://yadverse.tech',
    place: 'Kathmandu, Nepal',
    period: 'Jan 2025 to now',
    points: [
      'Cofounded a three person software studio that builds web apps, AI products and hosting for clients in Nepal and Australia.',
      'Own frontend and backend architecture for client projects from scoping through to production.',
      'Run reverse proxy hosting on studio managed servers, with services that restart themselves.',
    ],
  },
  {
    role: 'Full stack developer',
    org: 'BRCRN Project, Government of Nepal',
    place: 'Ministry of Agriculture, Forest and Environment',
    period: 'May 2026 to Jul 2026',
    points: [
      'Delivered two production systems during a 50 day technical internship on a GCF and FAO funded project.',
      'Built the Plantation Monitoring System: an Android field app and web portal on one database, loaded with baseline data for all 26 river systems.',
      'Built the Churia Knowledge Centre, including a tool that finds, fetches and classifies ministry documents automatically.',
    ],
  },
  {
    role: 'WordPress developer',
    org: 'YourFleetElite',
    href: 'https://yourfleetelite.com.au/',
    place: 'Sydney, Australia (remote)',
    period: 'Contract',
    points: ['Built and maintained the production site, improving speed and mobile layout.'],
  },
];

export const SKILLS = [
  { group: 'Languages', items: ['JavaScript', 'TypeScript', 'Python', 'C#', 'C', 'SQL'] },
  { group: 'Frontend', items: ['React', 'Next.js', 'Tailwind CSS', 'three.js', 'Framer Motion'] },
  { group: 'Backend', items: ['Node.js', 'Express', 'FastAPI', 'REST APIs', 'JWT', 'Role based access'] },
  { group: 'Data', items: ['PostgreSQL', 'MySQL', 'MongoDB', 'Supabase', 'Prisma'] },
  { group: 'AI', items: ['RAG pipelines', 'LangChain', 'LlamaIndex', 'Ollama', 'MCP', 'Whisper'] },
  { group: 'Ops', items: ['Docker', 'GitHub Actions', 'Linux servers', 'Reverse proxy hosting'] },
  { group: 'Mobile and CMS', items: ['Android', 'Flutter', 'WordPress'] },
  { group: 'Design', items: ['Figma', 'Blender', 'Interaction design'] },
];

export const EDUCATION = [
  {
    degree: 'B.Tech, Computer Science and Engineering',
    school: 'Vellore Institute of Technology',
    place: 'Vellore, India',
    period: '2024 to now',
  },
  {
    degree: 'Cambridge A Level: Physics, Mathematics, Computer Science',
    school: 'Little Angels College',
    place: 'Kathmandu, Nepal',
    period: '2021 to 2023',
  },
];

export const REFERENCES = [
  { name: 'Kausher Ahmed P', title: 'Assistant Professor, VIT Vellore', contact: 'kauserahmed@vit.ac.in' },
  {
    name: 'Binod Gyawali',
    title: 'Planning and Monitoring Officer, BRCRN Project, Ministry of Agriculture, Forest and Environment',
  },
];

/** What each hole of the course opens. Geometry lives in three/course.js. */
export const HOLES = [
  {
    title: 'Hello',
    text: 'I’m Sakrit, a full stack and AI engineer from Bhaktapur, Nepal.',
    link: { label: 'About me', href: '#about' },
  },
  {
    title: 'The studio',
    text: 'I cofounded YADverse, a small studio building web apps, AI products and hosting.',
    link: { label: 'Experience', href: '#experience' },
  },
  {
    title: 'Agents with guardrails',
    text: 'Okta Access Airlock lets AI agents manage access, and refuses when the world has changed.',
    link: { label: 'See the project', href: '#airlock' },
  },
  {
    title: 'Government work',
    text: 'A plantation monitoring system for 26 river systems, running on a government server.',
    link: { label: 'See the project', href: '#plantation' },
  },
  {
    title: 'Clubhouse',
    text: 'That’s the round. If you have something to build, I’d like to hear about it.',
    link: { label: 'Get in touch', href: '#contact' },
  },
];
