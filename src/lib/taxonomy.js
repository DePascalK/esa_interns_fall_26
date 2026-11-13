/**
 * Classification rules — data only, meant to be edited.
 *
 * Keywords are plain strings or RegExps:
 *   - a trailing * marks a word stem ("astrophysic*" finds astrophysics, astrophysical)
 *   - matching is case-insensitive, except all-caps acronyms ("RF", "GNC")
 *   - spaces also match hyphens ("on board" finds "on-board")
 *   - a trailing plural s/es is accepted ("antenna" finds "antennas")
 *
 * Run `npm run report` after editing to see how every posting is tagged.
 */

/** Weight of a keyword hit per field. Requirements count less: many roles list Python as "desirable". */
export const FIELD_WEIGHTS = { title: 3, topic: 3, tasks: 2, requirements: 1 };

/** A discipline is assigned when its score reaches this value. */
export const ASSIGN_THRESHOLD = 3;

/** Per field, at most this many distinct keywords count (stops long texts from dominating). */
export const MAX_HITS_PER_FIELD = 2;

/**
 * technical: true for engineering, science and IT disciplines.
 * directorates: a small prior (+1) when the posting's directorate matches.
 */
export const DISCIPLINES = [
  {
    id: 'rf-telecom', label: 'RF & communications', technical: true,
    keywords: ['radio frequency', 'RF', 'antenna', 'microwave', 'telecommunication', 'satellite communication',
      'communication system', 'communications system', 'optical communication', 'quantum communication',
      'link budget', 'modulation', 'signal processing', 'waveguide', 'spectrum management', 'radio', '5G', '6G',
      'transponder', 'telemetry and telecommand', 'SATCOM', 'payload processor', 'beamforming'],
    directorates: [/telecommunication|connectivity|secure communication/i],
  },
  {
    id: 'navigation', label: 'GNSS & navigation', technical: true,
    keywords: ['GNSS', 'Galileo', 'EGNOS', 'satellite navigation', 'positioning', 'PNT', 'timing and synchronisation',
      'navigation signal', 'navigation system', 'atomic clock', 'LEO-PNT', 'precise orbit determination'],
    directorates: [/navigation/i],
  },
  {
    id: 'electronics', label: 'Electronics & FPGA', technical: true,
    keywords: ['electronic', 'FPGA', 'ASIC', 'VHDL', 'Verilog', 'microcontroller', 'embedded system',
      'embedded software', 'PCB', 'circuit', 'avionics', 'on board computer', 'power system', 'power electronics',
      'EEE component', 'radiation effect', 'radiation hardness', 'semiconductor', 'data handling', 'SpaceWire',
      'microelectronics', 'battery', 'solar array', 'electrical'],
    directorates: [],
  },
  {
    id: 'optics', label: 'Optics & instruments', technical: true,
    keywords: ['optics', 'optical', 'telescope', 'detector', 'spectrograph', 'spectrometer', 'instrument', 'photonics',
      'laser', 'lidar', 'infrared', 'imaging sensor', 'camera', 'interferometr*', 'instrumentation'],
    directorates: [],
  },
  {
    id: 'mechanical', label: 'Mechanical, thermal & materials', technical: true,
    keywords: ['mechanical', 'structural', 'structures', 'thermal', 'material', 'CAD', 'finite element', 'FEM', 'FEA',
      'tribology', 'mechanism', 'composite', 'manufacturing', 'additive manufacturing', '3D printing', 'SolidWorks',
      'CATIA', 'vibration', 'cryogenic', 'metallurg*', 'corrosion'],
    directorates: [],
  },
  {
    id: 'propulsion', label: 'Propulsion & launchers', technical: true,
    keywords: ['propulsion', 'propellant', 'thruster', 'rocket engine', 'launcher', 'launch vehicle', 'Ariane', 'Vega',
      'combustion', 'electric propulsion', 're entry', 'reentry', 'aerothermodynamic*', 'fluid dynamics', 'CFD',
      'space transportation', 'reusab*'],
    directorates: [/space transportation/i],
  },
  {
    id: 'gnc-robotics', label: 'GNC, robotics & autonomy', technical: true,
    keywords: ['GNC', 'AOCS', 'guidance', 'attitude control', 'attitude determination', 'control system',
      'control engineering', 'robotic', 'robot', 'rover', 'autonomy', 'autonomous', 'Kalman', 'rendezvous',
      'docking', 'manipulator'],
    directorates: [],
  },
  {
    id: 'systems-ops', label: 'Systems, missions & operations', technical: true,
    keywords: ['systems engineering', 'system engineering', 'mission analysis', 'mission design', 'orbit', 'orbital',
      'trajectory', 'flight dynamics', 'concurrent design', 'space debris', 'space safety', 'planetary defence',
      'space weather', 'ground segment', 'ground station', 'spacecraft operations', 'mission operations',
      'mission control', 'operations engineer', 'cubesat', 'in orbit demonstration', 'mission concept',
      'feasibility stud*', 'trade off', 'subsystem', 'sub system', 'clean space', 'ecodesign', 'life cycle assessment'],
    directorates: [/^operations$/i],
  },
  {
    id: 'data-ai', label: 'Data science & AI', technical: true,
    keywords: ['machine learning', 'deep learning', 'neural network', 'artificial intelligence', 'AI', 'data science',
      'data scientist', 'data analysis', 'data analytics', 'statistical', 'PyTorch', 'TensorFlow', 'computer vision',
      'LLM', 'large language model', 'anomaly detection', 'big data', 'foundation model', 'generative', 'data mining',
      'predictive'],
    directorates: [],
  },
  {
    id: 'software', label: 'Software & IT', technical: true,
    keywords: ['software', 'programming', 'developer', 'web application', 'web development', 'database', 'DevOps',
      'cloud', 'cyber security', 'cybersecurity', 'information security', 'API', 'front end', 'back end',
      'full stack', 'Linux', 'Java', 'C++', 'JavaScript', 'TypeScript', 'Python', 'code', 'coding', 'algorithm',
      'IT infrastructure', 'digital twin', 'simulation tool', 'software engineering', 'automation', 'scripting'],
    directorates: [/internal services|digital/i],
  },
  {
    id: 'earth-observation', label: 'Earth observation & climate', technical: true,
    keywords: ['Earth observation', 'remote sensing', 'SAR', 'synthetic aperture radar', 'Copernicus', 'Sentinel',
      'climate', 'hyperspectral', 'multispectral', 'land cover', 'atmospher*', 'ocean', 'cryosphere', 'altimetry',
      'meteorolog*', 'EO data', 'Earth science'],
    directorates: [/earth observation/i],
  },
  {
    id: 'space-science', label: 'Astronomy & space science', technical: true,
    keywords: ['astronomy', 'astronomical', 'astrophysic*', 'planetary science', 'planetology', 'heliophysic*', 'solar physics', 'cosmology',
      'exoplanet', 'galax*', 'X ray', 'light curve', 'spectra', 'spectroscop*', 'gravitational',
      'space science', 'scientific data', 'science operations', 'Gaia', 'Euclid', 'JWST', 'Hubble', 'XMM',
      'comet', 'asteroid', 'magnetosphere', 'plasma'],
    directorates: [/^science$/i],
  },
  {
    id: 'human-spaceflight', label: 'Human spaceflight & life sciences', technical: true,
    keywords: ['astronaut', 'human spaceflight', 'life science', 'physiology', 'biology', 'biomedical', 'medical',
      'microgravity', 'International Space Station', 'ISS', 'habitat', 'lunar', 'Moon', 'Mars',
      'radiation biology', 'human factors'],
    directorates: [/human and robotic exploration|exploration/i],
  },
  {
    id: 'product-assurance', label: 'Quality & product assurance', technical: true,
    keywords: ['product assurance', 'quality assurance', 'reliability', 'dependability', 'ECSS', 'standardisation',
      'verification', 'qualification test', 'test campaign', 'non conformance', 'failure analysis', 'safety analysis'],
    directorates: [],
  },
  {
    id: 'business', label: 'Business, finance & procurement', technical: false,
    keywords: ['finance', 'financial', 'budget', 'procurement', 'contract', 'audit', 'accounting', 'economic',
      'business', 'commerciali*', 'market', 'marketing', 'investment', 'entrepreneur*', 'start up',
      'startup', 'incubat*', 'industrial policy', 'industrial return', 'geo return', 'cost', 'pricing',
      'programme control', 'project control', 'Power BI', 'dashboard', 'reporting'],
    directorates: [/commercialisation|industry and competitiveness|resources management|finance/i],
  },
  {
    id: 'law-policy', label: 'Law, policy & international relations', technical: false,
    keywords: ['legal', 'law', 'lawyer', 'space policy', 'public policy', 'policy maker', 'policy analysis',
      'policy development', 'international relations', 'regulatory', 'regulation',
      'intellectual property', 'governance', 'strategy', 'strategic planning', 'diplomac*', 'treaty', 'compliance',
      'institutional', 'European Union', 'member states', 'security policy'],
    directorates: [/strategy|legal|external matters/i],
  },
  {
    id: 'comms-education', label: 'Communication, outreach & education', technical: false,
    keywords: ['communication campaign', 'communications team', 'corporate communication', 'public communication',
      'media relations', 'public relations', 'social media', 'outreach', 'storytelling', 'web content',
      'content creation', 'journalism', 'video production', 'graphic design', 'event organi*', 'event management',
      'education', 'educational', 'teacher', 'didactic', 'e learning', 'STEM', 'museum', 'editorial', 'branding',
      'audience'],
    directorates: [],
  },
  {
    id: 'hr-admin', label: 'HR, admin & facilities', technical: false,
    keywords: ['human resources', 'HR', 'recruitment', 'talent', 'learning and development', 'facility', 'facilities',
      'real estate', 'administrat*', 'document management', 'knowledge management', 'SharePoint',
      'office management', 'occupational', 'health and safety', 'environmental management'],
    directorates: [/human resources|internal services|resources management/i],
  },
];

/**
 * Tools and techniques shown as skill chips. `match` entries are RegExps,
 * tested against topic, tasks and requirements.
 */
export const SKILLS = [
  { label: 'Python', match: [/\bpython\b/i] },
  { label: 'C/C++', match: [/C\+\+/, /\bC\/C\+\+/, /\bC (?:language|programming|code)\b/, /\bin C\b/] },
  { label: 'MATLAB/Simulink', match: [/\bmatlab\b/i, /\bsimulink\b/i] },
  { label: 'Java', match: [/\bjava\b(?!script)/i] },
  { label: 'JavaScript/TypeScript', match: [/\bjavascript\b/i, /\btypescript\b/i, /\breact\b(?=\W|$)/] },
  { label: 'HTML/CSS', match: [/\bHTML\b/, /\bCSS\b/] },
  { label: 'SQL', match: [/\bSQL\b/, /\bPostgre(SQL|s)\b/i] },
  { label: 'R', match: [/\bR\b(?= (?:programming|language|studio|or python|and python))/, /\bRStudio\b/i, /\bpython (?:or|and) R\b/i] },
  { label: 'Fortran', match: [/\bfortran\b/i] },
  { label: 'VHDL/Verilog', match: [/\bVHDL\b/i, /\bverilog\b/i, /\bsystemverilog\b/i] },
  { label: 'FPGA', match: [/\bFPGAs?\b/] },
  { label: 'LabVIEW', match: [/\blabview\b/i] },
  { label: 'PyTorch', match: [/\bpytorch\b/i] },
  { label: 'TensorFlow', match: [/\btensorflow\b/i, /\bkeras\b/i] },
  { label: 'scikit-learn', match: [/\bscikit-?learn\b/i] },
  { label: 'Machine learning', match: [/\bmachine[\s-]learning\b/i, /\bdeep[\s-]learning\b/i, /\bneural networks?\b/i] },
  { label: 'Computer vision', match: [/\bcomputer vision\b/i, /\bimage processing\b/i] },
  { label: 'Signal processing', match: [/\bsignal processing\b/i, /\bDSP\b/] },
  { label: 'Statistics', match: [/\bstatistic(?:s|al)\b/i] },
  { label: 'GIS', match: [/\bQGIS\b/i, /\bArcGIS\b/i, /\bGIS\b/] },
  { label: 'Docker/Kubernetes', match: [/\bdocker\b/i, /\bkubernetes\b/i, /\bcontaineri[sz]/i] },
  { label: 'Git', match: [/\bgit\b/i, /\bgitlab\b/i, /\bgithub\b/i] },
  { label: 'Linux/Unix', match: [/\blinux\b/i, /\bunix\b/i, /\bcommand[\s-]line\b/i] },
  { label: 'CAD', match: [/\bCAD\b/, /\bsolidworks\b/i, /\bCATIA\b/i, /\bsiemens nx\b/i, /\bcreo\b/i] },
  { label: 'FEM/FEA', match: [/\bfinite[\s-]element\b/i, /\bFE[MA]\b/, /\bansys\b/i, /\babaqus\b/i, /\bnastran\b/i, /\bcomsol\b/i] },
  { label: 'Thermal analysis', match: [/\bESATAN\b/i, /\bthermal (?:analysis|model+ing|desktop)\b/i] },
  { label: 'Orbit tools (STK/GMAT/Orekit)', match: [/\bSTK\b/, /\bGMAT\b/, /\borekit\b/i, /\bsystems tool kit\b/i] },
  { label: 'ROS', match: [/\bROS2?\b/] },
  { label: 'Power BI', match: [/\bpower\s?bi\b/i] },
  { label: 'Excel', match: [/\bexcel\b/i] },
  { label: 'Tableau', match: [/\btableau\b/i] },
  { label: 'SharePoint', match: [/\bsharepoint\b/i] },
  { label: 'Copilot Studio', match: [/\bcopilot studio\b/i] },
  { label: 'Adobe Creative Suite', match: [/\badobe\b/i, /\bphotoshop\b/i, /\billustrator\b/i, /\bindesign\b/i, /\bpremiere\b/i, /\bafter effects\b/i] },
  { label: 'Video editing', match: [/\bvideo editing\b/i, /\bvideo production\b/i] },
  { label: 'LaTeX', match: [/\blatex\b/i] },
  { label: 'SAP', match: [/\bSAP\b(?! ?\w*radar)/] },
  { label: 'Systems engineering', match: [/\bsystems? engineering\b/i, /\bMBSE\b/, /\bSysML\b/i] },
  { label: 'Project management', match: [/\bproject management\b/i] },
  { label: 'Data visualisation', match: [/\bdata visuali[sz]ation\b/i, /\bdashboards?\b/i] },
  { label: 'Cybersecurity', match: [/\bcyber[\s-]?security\b/i, /\binformation security\b/i] },
  { label: 'RF/antenna design', match: [/\bantennas?\b/i, /\bRF design\b/i, /\bmicrowave\b/i, /\bHFSS\b/, /\bCST\b/] },
  { label: 'Optics design', match: [/\bzemax\b/i, /\bcode v\b/i, /\boptical design\b/i] },
];

export const FOCUS = {
  technical: { label: 'Technical & science', rank: 0 },
  mixed: { label: 'Mixed', rank: 1 },
  'non-technical': { label: 'Non-technical', rank: 2 },
};

export const OTHER_DISCIPLINE = { id: 'other', label: 'Other / general', technical: false };
