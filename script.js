const sourceText = document.querySelector("#sourceText");
const analyzeButton = document.querySelector("#analyzeButton");
const sampleSlopButton = document.querySelector("#sampleSlopButton");
const sampleCleanButton = document.querySelector("#sampleCleanButton");
const sampleCodeButton = document.querySelector("#sampleCodeButton");
const clearButton = document.querySelector("#clearButton");
const modeButtons = document.querySelectorAll(".mode-button");
const scoreRing = document.querySelector("#scoreRing");
const scoreValue = document.querySelector("#scoreValue");
const verdict = document.querySelector("#verdict");
const scoreSummary = document.querySelector("#scoreSummary");
const metricOneLabel = document.querySelector("#metricOneLabel");
const metricTwoLabel = document.querySelector("#metricTwoLabel");
const metricThreeLabel = document.querySelector("#metricThreeLabel");
const metricFourLabel = document.querySelector("#metricFourLabel");
const clicheMetric = document.querySelector("#clicheMetric");
const genericMetric = document.querySelector("#genericMetric");
const detailMetric = document.querySelector("#detailMetric");
const rhythmMetric = document.querySelector("#rhythmMetric");
const flagList = document.querySelector("#flagList");
const axisList = document.querySelector("#axisList");
const axisTotalLabel = document.querySelector("#axisTotal");
const axisModeLabel = document.querySelector("#axisMode");
const highlightOutput = document.querySelector("#highlightOutput");
const rewriteList = document.querySelector("#rewriteList");
const cleanerOutput = document.querySelector("#cleanerOutput");
const cleanerGaps = document.querySelector("#cleanerGaps");
const modelRewriteButton = document.querySelector("#modelRewriteButton");
const modelRewriteStatus = document.querySelector("#modelRewriteStatus");
const useCleanerButton = document.querySelector("#useCleanerButton");
const copyCleanerButton = document.querySelector("#copyCleanerButton");

let selectedMode = "auto";
let latestCleanerDraft = "";
let modelRewriteBusy = false;

const SLOP_PATTERNS = [
  {
    type: "cliche opener",
    pattern: /\bin (?:today's|the)\s+(?:(?:fast[- ]paced|ever[- ]evolving|ever[- ]changing|rapidly[- ]changing|digital|modern|competitive|dynamic|hyper[- ]connected)\s+){1,3}(?:world|landscape|age|era|environment|marketplace|economy)\b/gi,
    weight: 10,
    note: "Common synthetic setup that rarely adds evidence."
  },
  {
    type: "hype phrase",
    pattern: /\b(?:game[- ]changers?|cutting[- ]edge|bleeding[- ]edge|revolutionary|revolutioniz(?:e|es|ing|ed)|transformative|next[- ]level|world[- ]class|best[- ]in[- ]class|state[- ]of[- ]the[- ]art|industry[- ]leading)\b/gi,
    weight: 7,
    note: "Big claim without proof."
  },
  {
    type: "generic promise",
    pattern: /\b(?:unlock|unleash|elevate|empower|leverage|streamline|optimize|optimise|harness|supercharge|turbocharge|revolutionize|spearhead)(?:s|es|ing|ed)?\b/gi,
    weight: 5,
    note: "Corporate verb that needs a concrete object or outcome."
  },
  {
    type: "AI tell",
    pattern: /\b(?:delve into|dive into|a testament to|plays a crucial role|it is important to note|cannot be overstated)\b/gi,
    weight: 8,
    note: "Frequently appears in generic generated prose."
  },
  {
    type: "empty abstraction",
    pattern: /\b(?:robust|seamless|dynamic|holistic|comprehensive|innovative|impactful|meaningful|scalable|efficient)\b/gi,
    weight: 4,
    note: "Adjective is doing work that evidence should do."
  },
  {
    type: "formula",
    pattern: /\bnot only\b[\s\S]{0,120}?\bbut also\b/gi,
    weight: 8,
    note: "Predictable generated sentence frame."
  },
  {
    type: "formula",
    pattern: /\bwhether you're\b[\s\S]{0,120}?\bor\b/gi,
    weight: 7,
    note: "Broad audience sweep that often signals filler."
  },
  {
    type: "closing mush",
    pattern: /\b(?:in conclusion|ultimately|at the end of the day|moving forward)\b/gi,
    weight: 5,
    note: "Transition can be useful, but often pads weak structure."
  },
  {
    type: "filler modifier",
    pattern: /\b(?:very|really|truly|highly|extremely|incredibly|significantly|essentially|basically)\b/gi,
    weight: 2,
    note: "Usually removable unless it changes the claim."
  },
  {
    type: "binary contrast",
    pattern: /\b[\w][\w\s'-]{0,38}?\s*(?:isn't|is not|aren't|are not|wasn't|was not|'s not|s not)\s+(?:just\s+)?(?:a\s+|an\s+|the\s+)?[\w-]+(?:\s+[\w-]+){0,3}\s*[.,;]\s*(?:it|this|that|they)(?:'s|s|\s+is|\s+are|\s+was)\s+/gi,
    weight: 9,
    note: "The 'it is not X, it is Y' frame is the most common generated rhetorical move."
  },
  {
    type: "throat clearing",
    pattern: /\b(?:here's the thing|let me be clear|let's be honest|let's be real|make no mistake|truth be told|here's what(?:'s| is)(?: really)? (?:going on|happening))\b/gi,
    weight: 8,
    note: "Announcing that a point is coming instead of making it."
  },
  {
    type: "faux insight",
    pattern: /\b(?:what (?:nobody|no one|few people) (?:tells you|talks about|realizes|mentions)|the part (?:everyone|most people|nobody) (?:misses|gets wrong|talks about)|what most people get wrong|the (?:real|dirty little) secret (?:is|here))\b/gi,
    weight: 9,
    note: "Claims hidden knowledge, then delivers something ordinary."
  },
  {
    type: "colon reveal",
    pattern: /\b(?:the (?:best|worst|hard|real|hidden|catch|kicker|twist|upshot|result|problem|point)(?: part| news| truth| bit)?)\s*:\s+\w/gi,
    weight: 6,
    note: "Colon used for suspense rather than structure."
  },
  {
    type: "dramatic fragment",
    pattern: /(?:^|[.!?]\s+)(?:that's it\.|that's the whole (?:thing|point|idea)\.|full stop\.|period\.|end of story\.|simple as that\.|that's the tell\.|nothing more\.)/gi,
    weight: 7,
    note: "One-line fragment doing the work of an argument."
  },
  {
    type: "fake profound ending",
    pattern: /\bthe\s+(?:future|answer|shift|change|revolution|question|opportunity)\s+(?:isn't|is not|wasn't|was not)\s+[\w\s-]{2,32}?\s*[.,]\s*(?:it's|its|it is)\s+(?:already\s+)?\w+/gi,
    weight: 10,
    note: "Closing line built for cadence, not for a claim."
  },
  {
    type: "importance puffery",
    pattern: /\b(?:marks? a (?:pivotal|defining|watershed|turning|critical) (?:moment|point)|signals? a (?:major |fundamental |real )?shift|represents? a (?:major|significant|fundamental) (?:leap|step|shift)|a watershed moment|usher(?:ing|s)? in a new (?:era|age|chapter))\b/gi,
    weight: 8,
    note: "Asserts significance instead of showing it."
  },
  {
    type: "superficial analysis",
    pattern: /\b(?:highlight(?:ing|s)?|demonstrat(?:ing|es?)|showcas(?:ing|es?)|underscor(?:ing|es?)|reflect(?:ing|s)?|signal(?:ing|s)?)\s+(?:the|their|its|a|an|our|his|her)\s+(?:\w+\s+){0,2}(?:commitment|dedication|focus|emphasis|approach|ability|potential|importance|willingness)\b/gi,
    weight: 7,
    note: "Restates the fact as a virtue rather than analysing it."
  },
  {
    type: "weasel attribution",
    pattern: /\b(?:experts?\s+(?:agree|say|suggest|note)|studies\s+(?:show|suggest|indicate|have shown)|research\s+(?:shows|suggests|indicates)|it(?:'s| is)\s+(?:widely\s+)?(?:known|believed|accepted|understood)|many\s+(?:would\s+)?(?:argue|say|agree))\b/gi,
    weight: 8,
    note: "Attribution with no source. Name the study or drop the claim."
  }
];

const CODE_PATTERNS = [
  {
    type: "not_implemented",
    pattern: /\b(?:raise\s+NotImplementedError|throw\s+new\s+Error\(["'`]not implemented["'`]\)|TODO:\s*implement)\b/gi,
    weight: 14,
    critical: true,
    note: "Explicit unfinished implementation."
  },
  {
    type: "pass_placeholder",
    pattern: /^\s*pass\s*(?:#.*)?$/gmi,
    weight: 12,
    critical: true,
    note: "Function body is present but intentionally empty."
  },
  {
    type: "ellipsis_placeholder",
    pattern: /^\s*(?:\.\.\.|…)\s*$/gmi,
    weight: 11,
    critical: true,
    note: "Ellipsis placeholder instead of logic."
  },
  {
    type: "return_empty_stub",
    pattern: /\breturn\s+(?:None|null|undefined|true|false|0|1|""|''|`[^`]{0,20}`)\s*;?/gi,
    weight: 8,
    critical: false,
    note: "Constant return can be a stub when it stands in for real behavior."
  },
  {
    type: "todo_comment",
    pattern: /(?:\/\/|#|\/\*)\s*(?:TODO|FIXME|HACK|XXX)\b[^\n*]*/gi,
    weight: 7,
    critical: false,
    note: "Placeholder comment left in production-looking code."
  },
  {
    type: "empty_function",
    pattern: /(?:function\s+\w+\s*\([^)]*\)\s*{\s*}|(?:def\s+\w+\([^)]*\):\s*(?:pass|\.\.\.|return\s+None))|(?:\([^)]*\)|\w+)\s*=>\s*{\s*})/gi,
    weight: 14,
    critical: true,
    note: "Callable surface exists without implementation."
  },
  {
    type: "inflated_comment",
    pattern: /(?:\/\/|#|\/\*|\*)[^\n]*(?:robust|seamless|enterprise[- ]grade|production[- ]ready|cutting[- ]edge|scalable|comprehensive|leverage|orchestrate|transformative)[^\n]*/gi,
    weight: 6,
    critical: false,
    note: "Comment promises maturity that the code may not prove."
  },
  {
    type: "bare_except",
    pattern: /^\s*except\s*:\s*$/gmi,
    weight: 8,
    critical: false,
    note: "Swallows errors too broadly."
  },
  {
    type: "star_import",
    pattern: /^\s*(?:from\s+[\w.]+\s+import\s+\*|import\s+\*\s+from\s+["'][^"']+["'];?)/gmi,
    weight: 7,
    critical: false,
    note: "Wildcard imports hide dependency boundaries."
  },
  {
    type: "global_statement",
    pattern: /^\s*global\s+\w+/gmi,
    weight: 7,
    critical: false,
    note: "Hidden shared state makes behavior harder to reason about."
  },
  {
    type: "debug_output",
    pattern: /\b(?:console\.(?:log|debug)|print\s*\(|fmt\.Print(?:ln|f)?\s*\()/g,
    weight: 4,
    critical: false,
    note: "Debug output often survives generated scaffolding."
  },
  {
    type: "ignored_error",
    pattern: /\b(?:catch\s*\([^)]*\)\s*{\s*}|_\s*=\s*[^;\n]+)/g,
    weight: 7,
    critical: false,
    note: "Error path exists but may not be handled."
  },
  {
    type: "placeholder_name",
    pattern: /\b(?:foo|bar|baz|tmp|stuff|thing|things|obj|someData|dummy|placeholder)\b/g,
    weight: 4,
    critical: false,
    note: "Placeholder naming can signal low semantic intent."
  },
  {
    type: "hedging_comment",
    pattern: /(?:\/\/|#)[^\n]*\b(?:should work|hopefully|i think|not sure|might need|might break|probably (?:works|fine|ok)|this should be fine|may need to|assuming (?:this|that|it)|for now|temporary(?: fix)?|good enough)\b[^\n]*/gi,
    weight: 6,
    critical: false,
    note: "The comment admits uncertainty that the code never resolves."
  },
  {
    type: "mutable_default_arg",
    pattern: /\bdef\s+\w+\s*\([^)]*=\s*(?:\[\s*\]|\{\s*\}|set\(\)|dict\(\)|list\(\))[^)]*\)/g,
    weight: 12,
    critical: true,
    note: "Mutable default argument shares state across calls. Use None and build inside."
  }
];

// Idioms carried over from another language. Models blend syntax from
// everything they were trained on, so a Python file picks up JavaScript and
// Java habits.
const CROSS_LANGUAGE_PATTERNS = {
  python: [
    { pattern: /\.push\s*\(/g, note: "JavaScript .push() in Python. Use .append()." },
    { pattern: /\.forEach\s*\(/g, note: "JavaScript .forEach() in Python. Use a for loop." },
    { pattern: /\.length\b(?!\s*\()/g, note: "JavaScript .length in Python. Use len()." },
    { pattern: /\.equals\s*\(/g, note: "Java .equals() in Python. Use ==." },
    { pattern: /\.hashCode\s*\(/g, note: "Java .hashCode() in Python. Use hash()." },
    { pattern: /\btoString\s*\(\)/g, note: "Java or JavaScript toString() in Python. Use str()." },
    { pattern: /\bconsole\.log\s*\(/g, note: "JavaScript console.log in Python. Use print() or logging." },
    { pattern: /\bnull\b/g, note: "JavaScript or Java null in Python. Use None." },
    { pattern: /\.substring\s*\(/g, note: "Java or JavaScript substring() in Python. Use slicing." },
    { pattern: /\.trim\s*\(\)/g, note: "JavaScript .trim() in Python. Use .strip()." },
    { pattern: /\bStringBuilder\b/g, note: "Java StringBuilder in Python. Use str.join()." },
    { pattern: /^\s*(?:public|private|protected)\s+\w+\s+\w+\s*\(/gm, note: "Java access modifier in Python." }
  ],
  javascript: [
    { pattern: /\blen\s*\(/g, note: "Python len() in JavaScript. Use .length." },
    { pattern: /\.append\s*\(/g, note: "Python .append() in JavaScript. Use .push()." },
    { pattern: /\bNone\b/g, note: "Python None in JavaScript. Use null or undefined." },
    { pattern: /\b(?:True|False)\b/g, note: "Python True/False in JavaScript. Use true/false." },
    { pattern: /\belif\b/g, note: "Python elif in JavaScript. Use else if." },
    { pattern: /\b__init__\b/g, note: "Python __init__ in JavaScript. Use constructor()." },
    { pattern: /\bself\.\w/g, note: "Python self in JavaScript. Use this." },
    { pattern: /\bstr\s*\(/g, note: "Python str() in JavaScript. Use String()." }
  ]
};

// Word clusters that describe the same thing. Generated prose rotates through
// them to avoid repeating a noun, which reads as three different subjects.
const SYNONYM_CLUSTERS = [
  ["agent", "agents", "assistant", "assistants", "copilot", "bot", "bots"],
  ["platform", "solution", "solutions", "ecosystem", "suite", "engine"],
  ["user", "users", "customer", "customers", "client", "clients", "audience"],
  ["build", "builds", "create", "creates", "craft", "crafts", "develop", "develops"],
  ["insight", "insights", "learning", "learnings", "takeaway", "takeaways"],
  ["journey", "path", "roadmap", "trajectory"],
  ["tool", "tools", "system", "systems", "framework", "frameworks"],
  ["boost", "accelerate", "supercharge", "amplify", "turbocharge"]
];

// Every flag type belongs to exactly one axis. The axis points sum to the
// score, so the breakdown is always the reason for the number, never a
// separate opinion about it.
const PHRASING_TYPES = [
  "cliche opener",
  "hype phrase",
  "AI tell",
  "closing mush",
  "importance puffery",
  "superficial analysis",
  "weasel attribution"
];

const STRUCTURE_TYPES = [
  "formula",
  "binary contrast",
  "throat clearing",
  "faux insight",
  "colon reveal",
  "dramatic fragment",
  "fake profound ending",
  "tricolon"
];

const RHYTHM_TYPES = [
  "em_dash",
  "dash_run",
  "spaced_hyphen",
  "empty_quotes",
  "quote_marker",
  "smart_quote_marker"
];

const VOCABULARY_TYPES = ["generic promise", "empty abstraction", "filler modifier", "synonym cycling"];

const CODE_LIES_TYPES = [
  "not_implemented",
  "pass_placeholder",
  "ellipsis_placeholder",
  "empty_function",
  "return_empty_stub",
  "hedging_comment",
  "mutable_default_arg"
];

const CODE_NOISE_TYPES = ["debug_output", "todo_comment", "placeholder_name"];

const CODE_SOUL_TYPES = ["inflated_comment"];

const CODE_STRUCTURE_TYPES = ["bare_except", "star_import", "global_statement", "ignored_error", "cross_language"];

const ABSTRACT_WORDS = [
  "innovation",
  "solution",
  "journey",
  "landscape",
  "experience",
  "opportunity",
  "potential",
  "impact",
  "value",
  "growth",
  "transformation",
  "efficiency",
  "success",
  "future",
  "possibilities",
  "ecosystem",
  "synergy",
  "paradigm"
];

// Structural rewrites run before the word-level table. Each pattern consumes
// a whole construction, so removing one half of a frame cannot leave an orphan
// clause behind. Where a frame carries no claim at all, it is deleted; where it
// wraps a real claim, the wrapper goes and the claim stays.
const STRUCTURAL_REWRITES = [
  // "Our practice isn't just a function. It's a mindset."
  //   -> "Our practice is a mindset."  (subject kept, negation dropped)
  {
    pattern: /\b([\w][\w\s'-]{0,38}?)\s*(?:isn't|is not|'s not|s not)\s+(?:just\s+)?(?:a\s+|an\s+|the\s+)?[\w-]+(?:\s+[\w-]+){0,3}\s*[.,;]\s*(?:it|this|that)(?:'s|\s+is|\s+was)\s+/gi,
    replacement: "$1 is ",
    gap: "A contrast frame was collapsed to its claim. Check that the surviving sentence still says what you meant."
  },
  {
    pattern: /\b([\w][\w\s'-]{0,38}?)\s*(?:aren't|are not)\s+(?:just\s+)?(?:a\s+|an\s+|the\s+)?[\w-]+(?:\s+[\w-]+){0,3}\s*[.,;]\s*(?:they|these|those)(?:'re|\s+are|\s+were)\s+/gi,
    replacement: "$1 are ",
    gap: "A contrast frame was collapsed to its claim. Check that the surviving sentence still says what you meant."
  },
  // "The future isn't coming. It's already here." -> deleted outright
  {
    pattern: /\bthe\s+(?:future|answer|shift|change|revolution|question|opportunity)\s+(?:isn't|is not|wasn't|was not)\s+[\w\s-]{2,32}?\s*[.,]\s*(?:it's|its|it is)\s+(?:already\s+)?[\w\s-]{0,30}?[.!?]\s*/gi,
    replacement: "",
    gap: "A closing flourish was removed. End on the concrete finding instead."
  },
  // "Here's the thing." / "Let me be clear," -> deleted
  {
    pattern: /\b(?:here's the thing|let me be clear|let's be honest|let's be real|make no mistake|truth be told|here's what(?:'s| is)(?: really)? (?:going on|happening))\b[\s,.:;-]*/gi,
    replacement: ""
  },
  // "What nobody tells you is that X" -> "X"
  {
    pattern: /\b(?:what (?:nobody|no one|few people) (?:tells you|talks about|realizes|mentions)|the part (?:everyone|most people|nobody) (?:misses|gets wrong|talks about)|what most people get wrong|the (?:real|dirty little) secret (?:is|here))\s+(?:is\s+)?(?:that\s+)?/gi,
    replacement: ""
  },
  // "The best part: it scales." -> "It scales."
  {
    pattern: /\b(?:the (?:best|worst|hard|real|hidden|catch|kicker|twist|upshot|result|problem|point)(?: part| news| truth| bit)?)\s*:\s+/gi,
    replacement: ""
  },
  // "That's it." / "Full stop." -> deleted
  {
    pattern: /(?:^|(?<=[.!?]))\s*(?:that's it\.|that's the whole (?:thing|point|idea)\.|full stop\.|period\.|end of story\.|simple as that\.|that's the tell\.|nothing more\.)/gi,
    replacement: ""
  },
  // "Experts agree that X" -> "X", with the missing source recorded
  {
    pattern: /\b(?:experts?\s+(?:agree|say|suggest|note)|studies\s+(?:show|suggest|indicate|have shown)|research\s+(?:shows|suggests|indicates)|many\s+(?:would\s+)?(?:argue|say|agree))\s+(?:that\s+)?/gi,
    replacement: "",
    gap: "An unsourced appeal to experts or studies was removed. Name the source or drop the claim."
  },
  {
    pattern: /\bit(?:'s| is)\s+(?:widely\s+)?(?:known|believed|accepted|understood)\s+(?:that\s+)?/gi,
    replacement: "",
    gap: "An unattributed claim lost its hedge. Say who established it."
  },
  // "marks a pivotal moment" and friends carry no information
  {
    pattern: /[,;]?\s*\b(?:marks? a (?:pivotal|defining|watershed|turning|critical) (?:moment|point)|signals? a (?:major |fundamental |real )?shift|represents? a (?:major|significant|fundamental) (?:leap|step|shift)|usher(?:ing|s)? in a new (?:era|age|chapter))\b[^.!?]*/gi,
    replacement: "",
    gap: "A significance claim was removed. Show the change with a number or a before and after."
  },
  // ", highlighting their commitment to quality" -> deleted trailing clause
  {
    pattern: /[,;]\s*(?:highlight(?:ing|s)?|demonstrat(?:ing|es?)|showcas(?:ing|es?)|underscor(?:ing|es?)|reflect(?:ing|s)?|signal(?:ing|s)?)\s+(?:the|their|its|a|an|our|his|her)\s+(?:\w+\s+){0,2}(?:commitment|dedication|focus|emphasis|approach|ability|potential|importance|willingness)\b[^.!?]*/gi,
    replacement: ""
  }
];

// Cadence phrases the word table missed. Sourced from the same marker list the
// Python stylometry scorer uses, so both halves flag and fix the same things.
const PHRASE_REPLACEMENTS = [
  { pattern: /\b(?:the\s+)?rich tapestry of\b/gi, replacement: "the range of" },
  { pattern: /\bplays?\s+a\s+(?:pivotal|crucial|vital|key)\s+role\s+in\b/gi, replacement: "affects" },
  { pattern: /\bplays?\s+a\s+(?:pivotal|crucial|vital|key)\s+role\b/gi, replacement: "matters" },
  { pattern: /\bactionable insights?\b/gi, replacement: "findings you can act on" },
  { pattern: /\bmeaningful outcomes?\b/gi, replacement: "measurable outcomes" },
  { pattern: /\bimpactful outcomes?\b/gi, replacement: "measurable outcomes" },
  { pattern: /\ba myriad of\b/gi, replacement: "many" },
  { pattern: /\bparadigm shift\b/gi, replacement: "change in approach" },
  { pattern: /\bnavigat(?:e|ing|es)\s+the\s+(?:complexities|intricacies|nuances)\s+of\b/gi, replacement: "work through" },
  { pattern: /\bfoster(?:s|ing)?\s+a\s+(?:sense|culture)\s+of\b/gi, replacement: "builds" },
  { pattern: /\bunderscore(?:s|d)?\s+the\s+(?:importance|need|significance)\s+of\b/gi, replacement: "shows why" },
  { pattern: /\bserve(?:s|d)?\s+as\s+a\s+(?:beacon|reminder|catalyst|cornerstone)\s+(?:of|for)\b/gi, replacement: "is" },
  { pattern: /\bmultifaceted\s+(?:nature|approach|landscape)\b/gi, replacement: "range" },
  { pattern: /\bharness(?:ing|es)?\s+the\s+power\s+of\b/gi, replacement: "using" },
  { pattern: /\bseamlessly\s+(?:integrates?|blends?|combines?)\b/gi, replacement: "works with" },
  { pattern: /\bholistic\s+(?:approach|view|perspective)\b/gi, replacement: "complete view" },
  { pattern: /\bto summarize\b[,\s]*/gi, replacement: "" },
  { pattern: /\b(?:furthermore|moreover)\b[,\s]*/gi, replacement: "" },
  { pattern: /\bmindset\b/gi, replacement: "habit" }
];

const CLEANER_REPLACEMENTS = [
  {
    pattern: /\bin today's (?:(?:fast[- ]paced|ever[- ]evolving|digital|modern)\s+){1,3}(?:world|landscape|age|environment),?\s*/gi,
    replacement: ""
  },
  { pattern: /\bwhether you're[^.!?]*?\bor\s+\w+,?\s*/gi, replacement: "" },
  { pattern: /\b(?:founder|operator|creator),?\s+(?:or\s+)?(?:founder|operator|creator),?\s*/gi, replacement: "" },
  { pattern: /\bit is important to note that\s*/gi, replacement: "" },
  { pattern: /\b(?:in conclusion|ultimately|at the end of the day|moving forward),?\s*/gi, replacement: "" },
  { pattern: /\btransformation is not just about tools but also about mindset\b/gi, replacement: "change depends on tools and the habits around them" },
  { pattern: /\btransformation\b/gi, replacement: "change" },
  { pattern: /\b(?:delve|dive) into\b/gi, replacement: "examine" },
  { pattern: /\ba testament to\b/gi, replacement: "evidence of" },
  { pattern: /\bplays a crucial role in\b/gi, replacement: "affects" },
  { pattern: /\bcannot be overstated\b/gi, replacement: "matters" },
  { pattern: /\bis a game[- ]changer because\b/gi, replacement: "is useful because" },
  { pattern: /\bgame[- ]changer\b/gi, replacement: "meaningful change" },
  { pattern: /\bcutting[- ]edge\b/gi, replacement: "new" },
  { pattern: /\brevolutionary\b/gi, replacement: "different" },
  { pattern: /\btransformative\b/gi, replacement: "useful" },
  { pattern: /\bworld[- ]class\b/gi, replacement: "strong" },
  { pattern: /\bseamless(?:ly)?\b/gi, replacement: "" },
  { pattern: /\brobust\b/gi, replacement: "reliable" },
  { pattern: /\bdynamic\b/gi, replacement: "working" },
  { pattern: /\bholistic\b/gi, replacement: "complete" },
  { pattern: /\binnovative solutions\b/gi, replacement: "practical tools" },
  { pattern: /\bunlock(?:s|ing)?\s+(?:their|its|your|the)\s+full potential\b/gi, replacement: "reach a measurable outcome" },
  { pattern: /\bunlock\b/gi, replacement: "make possible" },
  { pattern: /\bunlocks\b/gi, replacement: "makes possible" },
  { pattern: /\bunlocking\b/gi, replacement: "making possible" },
  { pattern: /\bunleash(?:es|ing)?\b/gi, replacement: "support" },
  { pattern: /\belevates\b/gi, replacement: "improves" },
  { pattern: /\belevating\b/gi, replacement: "improving" },
  { pattern: /\belevate\b/gi, replacement: "improve" },
  { pattern: /\bempowers\b/gi, replacement: "helps" },
  { pattern: /\bempowering\b/gi, replacement: "helping" },
  { pattern: /\bempower\b/gi, replacement: "help" },
  { pattern: /\bleverages\b/gi, replacement: "uses" },
  { pattern: /\bleveraging\b/gi, replacement: "using" },
  { pattern: /\bleverage\b/gi, replacement: "use" },
  { pattern: /\bharnesses\b/gi, replacement: "uses" },
  { pattern: /\bharnessing\b/gi, replacement: "using" },
  { pattern: /\bharness\b/gi, replacement: "use" },
  { pattern: /\bstreamlines\b/gi, replacement: "simplifies" },
  { pattern: /\bstreamlining\b/gi, replacement: "simplifying" },
  { pattern: /\bstreamline\b/gi, replacement: "reduce friction in" },
  { pattern: /\boptimizes\b/gi, replacement: "improves" },
  { pattern: /\boptimizing\b/gi, replacement: "improving" },
  { pattern: /\boptimize\b/gi, replacement: "improve" },
  { pattern: /\bsupercharges?\b/gi, replacement: "speeds up" },
  { pattern: /\bsupercharging\b/gi, replacement: "speeding up" },
  { pattern: /\bevery touchpoint\b/gi, replacement: "a key customer interaction" },
  { pattern: /\bmeaningful insights\b/gi, replacement: "evidence" },
  { pattern: /\bimpactful growth\b/gi, replacement: "measurable growth" },
  { pattern: /\bdynamic systems\b/gi, replacement: "systems that support the workflow" },
  { pattern: /\bachieve success\b/gi, replacement: "hit clear targets" }
];

const SAMPLE_SLOP = `In today's fast-paced digital landscape, brands need innovative solutions that empower teams to unlock their full potential. Our cutting-edge platform is a game-changer because it seamlessly streamlines workflows and elevates every touchpoint.

Whether you're a founder, operator, or creator, this robust experience helps you harness meaningful insights and drive impactful growth. It is important to note that transformation is not just about tools but also about mindset. This "seamless" shift—built for "impact"—keeps teams moving - faster - smarter - better. Ultimately, the future belongs to teams that leverage dynamic systems to achieve success.`;

const SAMPLE_CLEAN = `The onboarding flow loses users at the third step. In April, 41 percent of new accounts reached the address form, but only 18 percent submitted it. The main issue is visible in support tickets: people do not know whether apartment numbers are required.

I would split the address form into two fields, mark the apartment field optional, and add inline validation before the submit button is enabled. That should reduce failed submissions without changing the rest of the signup flow.`;

const SAMPLE_CODE = `import axios from "axios";
import { parseCustomer, unusedHelper } from "./customers";

// Production-ready robust customer pipeline that seamlessly transforms data.
export async function syncCustomer(id) {
  // TODO: implement retry and validation
  console.log("syncing", id);
  const response = await axios.get("/api/customers/" + id);
  return null;
}

export function calculateRisk(foo) {
  return 0;
}

try:
  process_customer()
except:
  pass`;

const MODEL_SOURCE_LABELS = {
  local: "Local rules",
  provider: "Provider API",
  ollama: "Ollama",
  custom: "Custom endpoint"
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq",
  mistral: "Mistral",
  other: "Other"
};

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getWords(text) {
  return text.toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [];
}

function getSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stripCodeFences(text) {
  return text.replace(/^```[\w-]*\n?/gm, "").replace(/^```\s*$/gm, "");
}

// Prose analysis runs on rendered-ish text, not raw markup. Without this,
// every markdown bullet reads as a stray hyphen and every table rule as a
// dash run, which pegs the rhythm axis on any long-form document.
function stripMarkdown(text) {
  return stripCodeFences(text)
    .replace(/^ {0,3}```[\s\S]*?^ {0,3}```\s*$/gm, "")
    .replace(/^ {0,3}(?:[-*_]\s*){3,}$/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/^ {0,3}#{1,6}\s+/gm, "")
    .replace(/^ {0,3}>\s?/gm, "")
    .replace(/^(\s*)[-*+]\s+/gm, "$1")
    .replace(/^(\s*)\d+[.)]\s+/gm, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|\W)\*([^*\n]+)\*(\W|$)/g, "$1$2$3")
    .replace(/(^|\W)_([^_\n]+)_(\W|$)/g, "$1$2$3")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Moving-average type-token ratio. A flat unique/total ratio falls as a
// document gets longer no matter how well it is written, so the fixed
// threshold it replaced punished length instead of repetition. Window size
// matches the Python stylometry scorer so both halves agree.
function computeMattr(words, windowSize = 50) {
  const total = words.length;

  if (total === 0) {
    return 0;
  }

  if (total <= windowSize) {
    return new Set(words).size / total;
  }

  const counts = new Map();
  for (let i = 0; i < windowSize; i += 1) {
    counts.set(words[i], (counts.get(words[i]) || 0) + 1);
  }

  let sum = counts.size / windowSize;
  const windowCount = total - windowSize + 1;

  for (let i = 1; i < windowCount; i += 1) {
    const leaving = words[i - 1];
    const entering = words[i + windowSize - 1];
    const remaining = counts.get(leaving) - 1;

    if (remaining === 0) {
      counts.delete(leaving);
    } else {
      counts.set(leaving, remaining);
    }

    counts.set(entering, (counts.get(entering) || 0) + 1);
    sum += counts.size / windowSize;
  }

  return sum / windowCount;
}

function isCodeLike(text) {
  const code = stripCodeFences(text);
  const signals = [
    /\b(?:function|const|let|var|export|import)\b/.test(code),
    /\bdef\s+\w+\s*\(/.test(code),
    /\bclass\s+\w+/.test(code),
    /=>\s*[{(]/.test(code),
    /[{};]\s*$/.test(code),
    /\breturn\s+/.test(code),
    /^\s*(?:from\s+[\w.]+\s+import|import\s+[\w{*])/m.test(code),
    /(?:\/\/|#)\s*(?:TODO|FIXME|HACK|XXX)\b/i.test(code)
  ];

  return signals.filter(Boolean).length >= 2;
}

function findPatternHits(text, patterns) {
  const hits = [];

  for (const item of patterns) {
    item.pattern.lastIndex = 0;
    let match = item.pattern.exec(text);

    while (match) {
      const raw = match[0].replace(/\s+/g, " ").trim();
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        quote: raw.length > 140 ? `${raw.slice(0, 137)}...` : raw,
        type: item.type,
        weight: item.weight,
        note: item.note,
        critical: Boolean(item.critical)
      });
      match = item.pattern.exec(text);
    }
  }

  return hits.sort((a, b) => a.start - b.start || b.weight - a.weight);
}

function createPunctuationHit({ start, end, quote, type, weight, note }) {
  return {
    start,
    end,
    quote,
    type,
    weight,
    note,
    critical: false
  };
}

function collectRegexRanges(text, pattern, mapper) {
  const hits = [];
  pattern.lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    hits.push(mapper(match));
    match = pattern.exec(text);
  }

  return hits;
}

function findPunctuationHits(text, words) {
  const hits = [];
  const wordBase = Math.max(1, words.length / 100);
  const emDashMatches = collectRegexRanges(text, /—/g, (match) =>
    createPunctuationHit({
      start: match.index,
      end: match.index + 1,
      quote: "—",
      type: "em_dash",
      weight: 2,
      note: "One em dash can be fine; repeated em dashes are a synthetic rhythm marker."
    })
  );
  const doubleDashHits = collectRegexRanges(text, /-{2,}/g, (match) =>
    createPunctuationHit({
      start: match.index,
      end: match.index + match[0].length,
      quote: match[0],
      type: "dash_run",
      weight: 3,
      note: "Repeated hyphens often stand in for cleaner sentence structure."
    })
  );
  const spacedHyphens = collectRegexRanges(text, /(^|\s)-(?=\s|$)/g, (match) => {
    const start = match.index + match[0].lastIndexOf("-");
    return createPunctuationHit({
      start,
      end: start + 1,
      quote: "-",
      type: "spaced_hyphen",
      weight: 2,
      note: "Repeated standalone hyphens can mimic AI cadence or unfinished structure."
    });
  });
  const emptyQuotes = collectRegexRanges(text, /""/g, (match) =>
    createPunctuationHit({
      start: match.index,
      end: match.index + 2,
      quote: '""',
      type: "empty_quotes",
      weight: 5,
      note: "Empty quote marks look like placeholder emphasis."
    })
  );
  const quotedPhrases = collectRegexRanges(text, /"[^"\n]{1,100}"/g, (match) =>
    createPunctuationHit({
      start: match.index,
      end: match.index + match[0].length,
      quote: match[0],
      type: "quote_marker",
      weight: 2,
      note: "Quoted phrases are useful in context, but overuse can signal generic emphasis."
    })
  );
  const smartQuoteHits = collectRegexRanges(text, /[“”]/g, (match) =>
    createPunctuationHit({
      start: match.index,
      end: match.index + 1,
      quote: match[0],
      type: "smart_quote_marker",
      weight: 1,
      note: "Quote marks become suspicious when used repeatedly for vague emphasis."
    })
  );

  // Absolute counts only mean something in a short passage. Past roughly a
  // page, three quotation marks is normal writing, so long text is judged on
  // density alone.
  const shortText = words.length < 200;
  const trips = (count, minCount, perHundred) =>
    count > 0 && ((shortText && count >= minCount) || count / wordBase >= perHundred);

  if (trips(emDashMatches.length, 1, 0.75)) {
    hits.push(...emDashMatches);
  }

  if (trips(doubleDashHits.length, 1, 0.4)) {
    hits.push(...doubleDashHits);
  }

  if (trips(spacedHyphens.length, 3, 2)) {
    hits.push(...spacedHyphens);
  }

  if (emptyQuotes.length > 0) {
    hits.push(...emptyQuotes);
  }

  if (trips(quotedPhrases.length, 3, 2)) {
    hits.push(...quotedPhrases);
  }

  if (trips(smartQuoteHits.length, 4, 3)) {
    hits.push(...smartQuoteHits);
  }

  return hits;
}

function findRepeatedStarts(sentences) {
  const counts = new Map();

  for (const sentence of sentences) {
    const start = getWords(sentence).slice(0, 3).join(" ");
    if (start.split(" ").length >= 2) {
      counts.set(start, (counts.get(start) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([phrase, count]) => ({ phrase, count }));
}

function findSynonymCycling(text, words) {
  if (words.length < 40) {
    return [];
  }

  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  const hits = [];

  for (const cluster of SYNONYM_CLUSTERS) {
    const present = cluster.filter((term) => counts.has(term));
    const distinctStems = new Set(present.map((term) => term.replace(/s$/, "")));

    if (distinctStems.size < 3) {
      continue;
    }

    const escaped = present.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const locator = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
    const match = locator.exec(text);

    hits.push({
      start: match ? match.index : 0,
      end: match ? match.index + match[0].length : 0,
      quote: [...distinctStems].slice(0, 4).join(" / "),
      type: "synonym cycling",
      weight: 7,
      note: "The same thing is renamed mid-passage. Pick one word and repeat it.",
      critical: false
    });
  }

  return hits;
}

function findTricolons(text, sentences) {
  const locator = /\b([\w-]+(?:\s[\w-]+)?),\s+([\w-]+(?:\s[\w-]+)?),\s+and\s+([\w-]+(?:\s[\w-]+)?)\b/gi;
  const found = [];
  locator.lastIndex = 0;
  let match = locator.exec(text);

  while (match) {
    found.push(match);
    match = locator.exec(text);
  }

  // Three-item lists are ordinary English, so a handful across a normal-length
  // piece is not a tell. Only flag when tricolons are both frequent and dense
  // enough to read as a cadence habit rather than a few incidental lists.
  const words = getWords(text);
  const perHundred = found.length / Math.max(1, words.length / 100);

  if (found.length < 3 || sentences.length < 3 || perHundred < 1.6) {
    return [];
  }

  return found.map((item) => ({
    start: item.index,
    end: item.index + item[0].length,
    quote: item[0].length > 90 ? `${item[0].slice(0, 87)}...` : item[0],
    type: "tricolon",
    weight: 5,
    note: "Repeated rule-of-three lists are a cadence habit, not a structure.",
    critical: false
  }));
}

function detectCodeLanguage(code) {
  const pythonSignals =
    (code.match(/^\s*(?:def|elif|class)\s+\w|^\s*from\s+[\w.]+\s+import\b|^\s*import\s+\w+\s*$/gm) || []).length +
    (code.match(/^\s*(?:if|for|while|try|except|with)\b[^\n]*:\s*$/gm) || []).length;
  const jsSignals =
    (code.match(/^\s*(?:const|let|var|function|export|async function)\b/gm) || []).length +
    (code.match(/=>/g) || []).length +
    (code.match(/;\s*$/gm) || []).length * 0.5;

  if (pythonSignals >= 1 && pythonSignals > jsSignals) {
    return "python";
  }

  if (jsSignals >= 1 && jsSignals > pythonSignals) {
    return "javascript";
  }

  return "unknown";
}

function findCrossLanguageHits(code, language) {
  const table = CROSS_LANGUAGE_PATTERNS[language];

  if (!table) {
    return [];
  }

  const hits = [];

  for (const item of table) {
    item.pattern.lastIndex = 0;
    let match = item.pattern.exec(code);

    while (match) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        quote: match[0].trim(),
        type: "cross_language",
        weight: 6,
        critical: false,
        note: item.note
      });
      match = item.pattern.exec(code);
    }
  }

  return hits;
}

function buildAxes(definitions) {
  return definitions.map((axis) => {
    const points = Math.round(clamp(axis.raw, 0, axis.cap) * 10) / 10;
    const severity = axis.cap > 0 ? clamp(points / axis.cap, 0, 1) : 0;

    return {
      key: axis.key,
      label: axis.label,
      points,
      cap: axis.cap,
      severity: Math.round(severity * 100),
      note: axis.note
    };
  });
}

function axisTotal(axes) {
  return Math.round(clamp(axes.reduce((sum, axis) => sum + axis.points, 0), 0, 100));
}

function sumWeights(hits, types) {
  const wanted = new Set(types);
  return hits.filter((hit) => wanted.has(hit.type)).reduce((sum, hit) => sum + hit.weight, 0);
}

function countAbstractWords(words) {
  const abstractSet = new Set(ABSTRACT_WORDS);
  return words.filter((word) => abstractSet.has(word)).length;
}

function getConcreteDetailScore(text, words) {
  if (words.length === 0) {
    return 0;
  }

  const numbers = (text.match(/\b\d+(?:[.,]\d+)?%?\b/g) || []).length;
  const namedThings = (text.match(/\b[A-Z][a-z]{2,}\s+[A-Z][A-Za-z]{2,}\b/g) || []).length;
  const dates = (text.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi) || []).length;
  const concreteSignals = numbers + namedThings + dates;
  const density = concreteSignals / Math.max(1, words.length / 100);

  return clamp(Math.round(density * 18), 0, 100);
}

function getRhythmSameness(sentences) {
  if (sentences.length < 3) {
    return 0;
  }

  const lengths = sentences.map((sentence) => getWords(sentence).length);
  const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const variance = lengths.reduce((sum, length) => sum + (length - average) ** 2, 0) / lengths.length;
  const standardDeviation = Math.sqrt(variance);
  const repeatedStarts = findRepeatedStarts(sentences).length;
  const lengthSameness = average >= 10 && average <= 28 ? clamp(100 - standardDeviation * 12, 0, 100) : 20;
  const startPenalty = clamp(repeatedStarts * 20, 0, 45);

  // Staccato fragmentation: a run of very short sentences ("It works. It
  // scales. It ships.") reads as machine cadence but sits below the mid-length
  // band the sameness check covers, so it needs its own signal.
  const shortSentences = lengths.filter((length) => length > 0 && length <= 5).length;
  const shortRatio = shortSentences / lengths.length;
  const staccatoPenalty = lengths.length >= 4 && shortRatio >= 0.6 ? clamp(shortRatio * 60, 0, 55) : 0;

  return Math.round(clamp(lengthSameness + startPenalty + staccatoPenalty, 0, 100));
}

function normalizeCleanerDraft(text) {
  return text
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/,\s*,+/g, ",")
    .replace(/(?:,[ \t]*){2,}/g, ", ")
    .replace(/([a-z])\s+,\s+/gi, "$1, ")
    .replace(/\b(deliver|provide|offer|build|create|drive|bring|ship|design|support)s?\s*,\s+([a-z])/gi, "$1 $2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\bthat help teams to\b/gi, "that help teams")
    .replace(/\bhelps you use\b/gi, "uses")
    .replace(/\buses usable evidence and drive\b/gi, "uses usable evidence to drive")
    .replace(/\buses evidence and drive\b/gi, "uses evidence to drive")
    .replace(/\bThis reliable experience uses evidence\b/gi, "The platform uses evidence")
    .replace(/\bThis experience uses evidence\b/gi, "The platform uses evidence")
    .replace(/\bThis\s+(reliable\s+)?experience\s+uses\b/gi, "This $1experience uses")
    .replace(/\bThis shift, built for impact,\s*/gi, "This shift ")
    .replace(/\bkeeps teams moving,\s*faster,\s*smarter,\s*better\b/gi, "helps teams move faster with clearer priorities")
    .replace(/([.!?])([A-Za-z])/g, "$1 $2")
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/(^|[.!?][ \t]+)([a-z])/g, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function removeThinSentences(text) {
  return text
    .split(/(\n{2,})/)
    .map((part) => {
      if (/^\n+$/.test(part)) {
        return part;
      }

      return part
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => {
          const words = getWords(sentence);
          const genericOnly =
            words.length <= 14 &&
            /\b(?:future|success|potential|possibilities|landscape|journey)\b/i.test(sentence) &&
            !/\b\d/.test(sentence);
          return !genericOnly;
        })
        .join(" ");
    })
    .join("");
}

// Collapse a synonym cluster onto the term the writer used most. Renaming the
// same thing three ways reads as three subjects, and the fix is mechanical.
function normalizeSynonyms(text) {
  let draft = text;
  const words = getWords(draft);
  const counts = new Map();

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  for (const cluster of SYNONYM_CLUSTERS) {
    const present = cluster.filter((term) => counts.has(term));
    const stems = new Set(present.map((term) => term.replace(/s$/, "")));

    if (stems.size < 3) {
      continue;
    }

    const canonical = present.reduce((best, term) => (counts.get(term) > (counts.get(best) || 0) ? term : best), present[0]);
    const canonicalStem = canonical.replace(/s$/, "");

    for (const term of present) {
      if (term.replace(/s$/, "") === canonicalStem) {
        continue;
      }

      const plural = /s$/.test(term);
      const target = plural ? `${canonicalStem}s` : canonicalStem;
      draft = draft.replace(new RegExp(`\\b${term}\\b`, "gi"), (match) =>
        /^[A-Z]/.test(match) ? target.charAt(0).toUpperCase() + target.slice(1) : target
      );
    }
  }

  return draft;
}

// Removes a sentence that is only a demonstrative with no verb ("This.",
// "It."), which is what a structural deletion can leave behind. Anything with
// a real predicate ("It scales.") is kept, so this cannot eat a live sentence.
function removeStrandedDemonstratives(text) {
  return text
    .replace(/(?:^|(?<=[.!?]))\s*(?:this|that|it|they|these|those)\s*[.!?]+/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Runs the rewrite passes on one block of text (no blank lines inside it).
// Kept separate so the whole draft can be cleaned paragraph by paragraph,
// which preserves the blank-line structure of threads and lists.
function cleanParagraph(block, gaps) {
  let draft = block;

  for (const item of STRUCTURAL_REWRITES) {
    item.pattern.lastIndex = 0;
    if (item.gap && item.pattern.test(draft)) {
      gaps.push(item.gap);
    }
    item.pattern.lastIndex = 0;
    draft = draft.replace(item.pattern, item.replacement);
  }

  for (const item of PHRASE_REPLACEMENTS) {
    draft = draft.replace(item.pattern, item.replacement);
  }

  for (const item of CLEANER_REPLACEMENTS) {
    draft = draft.replace(item.pattern, item.replacement);
  }

  draft = draft
    .replace(/\bnot only\b\s*([^.!?]{1,140}?)\s*\bbut also\b\s*/gi, "$1 and ")
    .replace(/\bwhether you're[^.!?]*?\bor\s+\w+,?\s*/gi, "")
    .replace(/\b(?:founder|operator|creator),?\s+(?:or\s+)?(?:founder|operator|creator),?\s*/gi, "")
    .replace(/\b(?:very|really|truly|highly|extremely|incredibly|significantly|essentially|basically)\s+/gi, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s*--+\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/""/g, "")
    .replace(/"([^"\n]{1,100})"/g, "$1")
    .replace(/[“”]/g, "");

  draft = normalizeSynonyms(draft);
  draft = removeThinSentences(normalizeCleanerDraft(draft));
  draft = removeStrandedDemonstratives(normalizeCleanerDraft(draft));
  return normalizeCleanerDraft(draft);
}

// A cleaner must never hand back text that scores worse than what it was given.
// It cleans each paragraph, keeps the paragraph structure, then re-scores. If
// the rewrite does not lower the slop score, the original is returned untouched
// with a note, so the tab can never make a piece look worse than it started.
function buildCleanerDraft(text, originalScore) {
  const source = stripMarkdown(text);
  const gaps = [];
  const blocks = source.split(/\n{2,}/);
  const cleanedBlocks = blocks.map((block) => (block.trim() ? cleanParagraph(block, gaps) : ""));
  const draft = cleanedBlocks.filter((block) => block.length > 0).join("\n\n").trim();

  const uniqueGaps = [...new Set(gaps)];

  if (!draft || draft.length < 24) {
    return {
      text: "State the concrete claim: who needs what, why it matters, and what evidence supports it.",
      gaps: uniqueGaps
    };
  }

  // Guardrail. originalScore is the score of the pasted text; only ship the
  // draft when it is strictly cleaner.
  const baseline = typeof originalScore === "number" ? originalScore : analyzeProseCore(text).score;
  const draftScore = analyzeProseCore(draft).score;

  if (draftScore >= baseline) {
    return {
      text: source.trim(),
      gaps: [],
      note: `No local rewrite scored cleaner than the original (${baseline}). The remaining signal is structure or missing detail that the rule-based cleaner will not touch. Left as is.`
    };
  }

  return { text: draft, gaps: uniqueGaps };
}

function suggestCleanerText(text) {
  return buildCleanerDraft(text).text;
}

function suggestCleanerCode({ hits, imports, usedImports, logicDensity, criticalCount, dependencyCoupling, score }) {
  const types = new Set(hits.map((hit) => hit.type));
  const steps = [];

  if (criticalCount > 0) {
    steps.push("Replace placeholders with real control flow, return values, and error paths.");
  }

  if (types.has("hedging_comment")) {
    steps.push("Resolve each hedging comment: verify the behavior it doubts, or handle the case it names.");
  }

  if (types.has("cross_language")) {
    steps.push("Replace idioms carried in from another language with this language's equivalents.");
  }

  if (types.has("inflated_comment")) {
    steps.push("Replace maturity claims in comments with exact preconditions, side effects, or failure cases.");
  }

  if (imports.length > usedImports) {
    steps.push("Remove unused imports or wire the imported functions into the implementation.");
  }

  if (logicDensity < 0.35) {
    steps.push("Add validation, branches, and testable behavior before adding more comments.");
  }

  if (dependencyCoupling < 0.5 && imports.length > 1) {
    steps.push("Narrow the dependency surface to the modules this snippet actually uses.");
  }

  if (steps.length === 0) {
    return "No structural rewrite is suggested. The scanner did not find code slop; review tests and runtime behavior next.";
  }

  const numbered = steps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  return `Code is not auto-rewritten, because a regex cannot safely edit logic. Repair plan:\n${numbered}`;
}

function getModelSettings() {
  return window.aiHygieneModelSettings?.get?.() || { source: "local" };
}

function getModelSourceLabel(settings = getModelSettings()) {
  if (settings.source === "provider" && settings.provider) {
    return `${PROVIDER_LABELS[settings.provider] || settings.provider} API`;
  }

  return MODEL_SOURCE_LABELS[settings.source] || MODEL_SOURCE_LABELS.local;
}

function updateModelRewriteControls(statusText) {
  if (!modelRewriteButton || !modelRewriteStatus) {
    return;
  }

  const settings = getModelSettings();
  const hasText = sourceText.value.trim().length > 0;
  modelRewriteButton.disabled = modelRewriteBusy || !hasText;
  modelRewriteButton.textContent = modelRewriteBusy
    ? "Generating..."
    : settings.source === "local"
      ? "Refresh local draft"
      : "Generate with model";
  modelRewriteStatus.textContent = statusText || getModelSourceLabel(settings);
}

function weightedGeometricMean(values, weights) {
  const entries = Object.keys(weights);
  const totalWeight = entries.reduce((sum, key) => sum + weights[key], 0);
  const weightedLogs = entries.reduce((sum, key) => {
    const safeValue = Math.max(0.0001, clamp(values[key], 0, 1));
    return sum + weights[key] * Math.log(safeValue);
  }, 0);

  return Math.exp(weightedLogs / totalWeight);
}

function isCommentLine(line) {
  return /^(?:\/\/|#|\/\*|\*|\*\/)/.test(line.trim());
}

function isImportLine(line) {
  return /^\s*(?:import\s|from\s+[\w.]+\s+import|const\s+\w+\s*=\s*require\(|let\s+\w+\s*=\s*require\(|var\s+\w+\s*=\s*require\()/.test(
    line
  );
}

function extractImports(code) {
  const imports = new Set();
  const lines = code.split("\n");

  for (const line of lines) {
    let match = line.match(/^\s*import\s+([\w$]+)\s+from\s+["'][^"']+["']/);
    if (match) {
      imports.add(match[1]);
    }

    match = line.match(/^\s*import\s+\*\s+as\s+([\w$]+)\s+from\s+["'][^"']+["']/);
    if (match) {
      imports.add(match[1]);
    }

    match = line.match(/^\s*import\s+{([^}]+)}\s+from\s+["'][^"']+["']/);
    if (match) {
      for (const name of match[1].split(",")) {
        imports.add(name.replace(/\bas\b\s+\w+/, "").trim().split(/\s+/).pop());
      }
    }

    match = line.match(/^\s*(?:const|let|var)\s+([\w$]+)\s*=\s*require\(/);
    if (match) {
      imports.add(match[1]);
    }

    match = line.match(/^\s*from\s+[\w.]+\s+import\s+(.+)/);
    if (match) {
      for (const name of match[1].split(",")) {
        imports.add(name.replace(/\bas\s+\w+/, "").trim().split(/\s+/)[0]);
      }
    }

    match = line.match(/^\s*import\s+(.+)/);
    if (match && !line.includes(" from ")) {
      for (const name of match[1].split(",")) {
        const cleanName = name.trim().split(/\s+as\s+/).pop().split(".")[0];
        if (/^[A-Za-z_$][\w$]*$/.test(cleanName)) {
          imports.add(cleanName);
        }
      }
    }
  }

  return [...imports].filter(Boolean);
}

function countUsedImports(code, imports) {
  const nonImportCode = code
    .split("\n")
    .filter((line) => !isImportLine(line))
    .join("\n");

  return imports.filter((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(nonImportCode)).length;
}

function analyzeInput(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return null;
  }

  const mode = selectedMode === "auto" ? (isCodeLike(trimmed) ? "code" : "text") : selectedMode;
  return mode === "code" ? analyzeCode(trimmed) : analyzeProse(trimmed);
}

function analyzeProseCore(rawText) {
  const text = stripMarkdown(rawText);
  const words = getWords(text);
  const sentences = getSentences(text);
  const hits = [
    ...findPatternHits(text, SLOP_PATTERNS),
    ...findPunctuationHits(text, words),
    ...findSynonymCycling(text, words),
    ...findTricolons(text, sentences)
  ].sort((a, b) => a.start - b.start || b.weight - a.weight);

  const abstractCount = countAbstractWords(words);
  const detailScore = getConcreteDetailScore(text, words);
  const rhythmSameness = getRhythmSameness(sentences);
  const mattr = computeMattr(words);
  const repeatedStarts = findRepeatedStarts(sentences);
  const longParagraphs = text.split(/\n{2,}/).filter((paragraph) => getWords(paragraph).length > 115).length;

  const phrasingWeight = sumWeights(hits, PHRASING_TYPES);
  const structureWeight = sumWeights(hits, STRUCTURE_TYPES);
  const rhythmWeight = sumWeights(hits, RHYTHM_TYPES);
  const vocabularyWeight = sumWeights(hits, VOCABULARY_TYPES);
  const genericCount = hits.filter((hit) => VOCABULARY_TYPES.includes(hit.type)).length;
  const diversityPenalty = words.length > 70 ? clamp((0.66 - mattr) * 45, 0, 9) : 0;
  const detailPenalty = words.length > 40 ? clamp((100 - detailScore) * 0.16, 0, 16) : 6;
  const abstractionPenalty = clamp((abstractCount / Math.max(1, words.length / 100)) * 6, 0, 12);

  const axes = buildAxes([
    {
      key: "phrasing",
      label: "Phrasing",
      cap: 38,
      raw: phrasingWeight * 1.4,
      note: "Cliches, hype, and stock AI phrases."
    },
    {
      key: "structure",
      label: "Structure",
      cap: 28,
      raw: structureWeight * 1.15 + longParagraphs * 4,
      note: "Rhetorical frames doing the work an argument should do."
    },
    {
      key: "rhythm",
      label: "Rhythm",
      cap: 20,
      raw: rhythmSameness * 0.18 + rhythmWeight * 1.6,
      note: "Sentence length variation and punctuation cadence."
    },
    {
      key: "substance",
      label: "Substance",
      cap: 20,
      raw: detailPenalty + abstractionPenalty,
      note: "Numbers, names, dates, and constraints versus abstract nouns."
    },
    {
      key: "vocabulary",
      label: "Vocabulary",
      cap: 18,
      raw: vocabularyWeight * 0.9 + diversityPenalty,
      note: "Corporate verbs, empty adjectives, and repeated word choice."
    }
  ]);

  const score = axisTotal(axes);

  return {
    mode: "text",
    score,
    hits,
    axes,
    metrics: {
      labels: ["Markers", "Generic words", "Concrete detail", "Sentence sameness"],
      values: [
        String(hits.filter((hit) => !VOCABULARY_TYPES.includes(hit.type)).length),
        String(genericCount + abstractCount),
        `${detailScore}%`,
        `${rhythmSameness}%`
      ]
    },
    suggestions: makeProseSuggestions({ score, hits, detailScore, rhythmSameness, repeatedStarts, abstractCount, words, axes }),
    normalizedText: text,
    canApplyCleaner: true
  };
}

function analyzeProse(rawText) {
  const core = analyzeProseCore(rawText);
  const cleaner = buildCleanerDraft(rawText, core.score);

  return {
    ...core,
    cleanerDraft: cleaner.text,
    cleanerGaps: cleaner.gaps,
    cleanerNote: cleaner.note || ""
  };
}

function analyzeCode(text) {
  const code = stripCodeFences(text);
  const lines = code.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim()).length || 1;
  const logicLines = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed && !isCommentLine(line) && !isImportLine(line) && !/^[{}()[\];,.]+$/.test(trimmed);
  }).length;
  const commentText = lines.filter(isCommentLine).join("\n");
  const commentWords = getWords(commentText);
  const language = detectCodeLanguage(code);
  const hits = [...findPatternHits(code, CODE_PATTERNS), ...findCrossLanguageHits(code, language)].sort(
    (a, b) => a.start - b.start || b.weight - a.weight
  );
  const criticalCount = hits.filter((hit) => hit.critical).length;
  const inflatedCommentHits = hits.filter((hit) => hit.type === "inflated_comment").length;
  const imports = extractImports(code);
  const usedImports = countUsedImports(code, imports);
  const logicDensity = logicLines / nonEmptyLines;
  const dependencyCoupling = imports.length ? usedImports / imports.length : 1;
  const inflationRatio = clamp((inflatedCommentHits + commentWords.length / 60) / Math.max(1, nonEmptyLines / 20), 0, 1);
  const purity = Math.exp(-0.5 * criticalCount);
  const dimensions = {
    ldr: clamp(logicDensity / 0.58, 0, 1),
    icr: clamp(1 - inflationRatio, 0.0001, 1),
    ddc: clamp(dependencyCoupling, 0.0001, 1),
    purity: clamp(purity, 0.0001, 1)
  };
  const weights = { ldr: 0.4, icr: 0.3, ddc: 0.2, purity: 0.1 };
  const quality = weightedGeometricMean(dimensions, weights);
  const densityGap = clamp((0.58 - logicDensity) / 0.58, 0, 1);

  const axes = buildAxes([
    {
      key: "lies",
      label: "Lies",
      cap: 34,
      raw: sumWeights(hits, CODE_LIES_TYPES) * 0.85 + (1 - purity) * 12 + (1 - dependencyCoupling) * 8,
      note: "Placeholders, stubs, hedged comments, and imports wired to nothing."
    },
    {
      key: "noise",
      label: "Noise",
      cap: 20,
      raw: sumWeights(hits, CODE_NOISE_TYPES) * 0.9,
      note: "Debug output, leftover TODOs, and placeholder naming."
    },
    {
      key: "soul",
      label: "Soul",
      cap: 24,
      raw: sumWeights(hits, CODE_SOUL_TYPES) * 0.9 + inflationRatio * 14 + densityGap * 10,
      note: "Comments promising more maturity than the logic shows."
    },
    {
      key: "structure",
      label: "Structure",
      cap: 26,
      raw: sumWeights(hits, CODE_STRUCTURE_TYPES) * 0.9,
      note: "Anti-patterns and idioms carried in from another language."
    }
  ]);

  // A file made mostly of placeholders is critical no matter how short it is.
  // The axis caps alone can under-score a tiny all-stub snippet, so floor the
  // result on how many stub signals fired.
  const stubCount = hits.filter((hit) =>
    ["empty_function", "pass_placeholder", "ellipsis_placeholder", "not_implemented", "return_empty_stub"].includes(hit.type)
  ).length;
  const placeholderFloor = stubCount >= 2 ? clamp(46 + stubCount * 9, 0, 92) : 0;
  const score = Math.max(axisTotal(axes), placeholderFloor);

  return {
    mode: "code",
    score,
    hits,
    axes,
    language,
    metrics: {
      labels: ["Logic density", "Inflation", "Dependency use", "Purity"],
      values: [
        `${Math.round(logicDensity * 100)}%`,
        `${Math.round(inflationRatio * 100)}%`,
        imports.length ? `${Math.round(dependencyCoupling * 100)}%` : "n/a",
        `${Math.round(purity * 100)}%`
      ]
    },
    suggestions: makeCodeSuggestions({
      hits,
      imports,
      usedImports,
      logicDensity,
      inflationRatio,
      criticalCount,
      dependencyCoupling,
      score,
      language,
      quality
    }),
    cleanerDraft: suggestCleanerCode({ hits, imports, usedImports, logicDensity, criticalCount, dependencyCoupling, score }),
    normalizedText: code,
    canApplyCleaner: false
  };
}

function makeProseSuggestions({ score, hits, detailScore, rhythmSameness, repeatedStarts, abstractCount, words, axes }) {
  const suggestions = [];
  const punctuationTypes = new Set(RHYTHM_TYPES);
  const worstAxis = [...(axes || [])].sort((a, b) => b.severity - a.severity)[0];

  if (worstAxis && worstAxis.points > 0) {
    suggestions.push(`Start with ${worstAxis.label.toLowerCase()}: it is contributing ${worstAxis.points} of the ${score} points. ${worstAxis.note}`);
  }

  if (hits.some((hit) => STRUCTURE_TYPES.includes(hit.type))) {
    suggestions.push("Rewrite the flagged rhetorical frames as plain statements. The frame is standing in for the point.");
  }

  if (hits.some((hit) => hit.type === "synonym cycling")) {
    suggestions.push("Pick one name for each thing and repeat it. Rotating synonyms reads as three different subjects.");
  }

  if (hits.length > 0) {
    suggestions.push("Delete or rewrite the flagged phrases first. Most of them can be replaced by one specific claim.");
  }

  if (hits.some((hit) => punctuationTypes.has(hit.type))) {
    suggestions.push("Check punctuation rhythm: em dashes, hyphens, and quote marks should clarify structure, not create artificial emphasis.");
  }

  if (detailScore < 25 && words.length > 40) {
    suggestions.push("Add concrete detail: who, when, where, numbers, constraints, examples, or a visible tradeoff.");
  }

  if (abstractCount > 3) {
    suggestions.push("Turn abstract nouns into observable actions. Example: replace \"growth\" with the exact metric that moved.");
  }

  if (rhythmSameness > 65) {
    suggestions.push("Vary sentence length and structure. Synthetic text often keeps the same mid-length rhythm.");
  }

  if (repeatedStarts.length > 0) {
    suggestions.push(`Change repeated sentence starts such as "${repeatedStarts[0].phrase}".`);
  }

  if (score < 30) {
    suggestions.push("This reads relatively specific. Keep checking whether each claim is backed by a concrete detail.");
  }

  return suggestions.slice(0, 7);
}

function makeCodeSuggestions({ hits, imports, usedImports, logicDensity, inflationRatio, criticalCount, dependencyCoupling, score, language }) {
  const suggestions = [];
  const types = new Set(hits.map((hit) => hit.type));

  if (types.has("cross_language")) {
    const target = language === "python" ? "Python" : language === "javascript" ? "JavaScript" : "this language";
    suggestions.push(`Idioms from another language leaked into ${target}. These usually run until they do not, so fix them before shipping.`);
  }

  if (types.has("hedging_comment")) {
    suggestions.push("A comment admits uncertainty the code never resolves. Either verify the behavior or handle the case it is worried about.");
  }

  if (criticalCount > 0) {
    suggestions.push("Implement or delete placeholder functions before polishing comments or naming.");
  }

  if (types.has("inflated_comment")) {
    suggestions.push("Make comments prove behavior with preconditions, failure modes, or examples instead of maturity claims.");
  }

  if (imports.length > usedImports) {
    suggestions.push("Remove unused imports or wire them into the execution path so dependencies match behavior.");
  }

  if (logicDensity < 0.35) {
    suggestions.push("Increase causal code density: real branches, validation, error handling, and return paths.");
  }

  if (types.has("debug_output")) {
    suggestions.push("Replace debug prints with structured error handling or remove them from production paths.");
  }

  if (dependencyCoupling < 0.5 && imports.length > 1) {
    suggestions.push("The import surface is wider than the code uses; narrow it before adding more logic.");
  }

  if (score < 30) {
    suggestions.push("No major structural slop was detected. Review tests next, because this scanner only checks static signals.");
  }

  return suggestions.slice(0, 7);
}

function getVerdict(score, mode) {
  const subject = mode === "code" ? "code" : "text";

  if (score >= 70) {
    return {
      title: "CRITICAL_DEFICIT",
      summary: `The ${subject} has high slop risk: placeholder signals, weak substance, or inflated claims dominate.`,
      color: "var(--red)"
    };
  }

  if (score >= 50) {
    return {
      title: "INFLATED_SIGNAL",
      summary: `The ${subject} has enough generic or hollow structure to require cleanup before use.`,
      color: "var(--amber)"
    };
  }

  if (score >= 30) {
    return {
      title: "SUSPICIOUS",
      summary: `The ${subject} has some slop signals. Review the flagged areas first.`,
      color: "var(--blue)"
    };
  }

  return {
    title: "CLEAN",
    summary: `The ${subject} avoids the common slop patterns this scanner checks.`,
    color: "var(--green)"
  };
}

function renderFlags(hits) {
  flagList.innerHTML = "";

  if (hits.length === 0) {
    flagList.innerHTML = '<li class="empty-state">No phrase-level or structural flags found.</li>';
    return;
  }

  for (const hit of hits.slice(0, 18)) {
    const item = document.createElement("li");
    item.className = "flag-item";
    item.innerHTML = `
      <div class="flag-top">
        <span class="flag-type">${escapeHtml(hit.type)}</span>
        <span class="flag-weight">+${hit.weight}</span>
      </div>
      <span class="flag-quote">"${escapeHtml(hit.quote)}"</span>
      <span class="flag-note">${escapeHtml(hit.note)}</span>
    `;
    flagList.appendChild(item);
  }
}

function renderHighlights(text, hits) {
  if (hits.length === 0) {
    highlightOutput.textContent = text || "No text to highlight.";
    return;
  }

  const ranges = [];

  for (const hit of hits) {
    const overlaps = ranges.some((range) => hit.start < range.end && hit.end > range.start);
    if (!overlaps) {
      ranges.push(hit);
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  let html = "";
  let cursor = 0;

  for (const range of ranges) {
    html += escapeHtml(text.slice(cursor, range.start));
    html += `<mark title="${escapeHtml(range.note)}">${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  html += escapeHtml(text.slice(cursor));
  highlightOutput.innerHTML = html;
}

function renderSuggestions(suggestions) {
  rewriteList.innerHTML = "";

  for (const suggestion of suggestions) {
    const item = document.createElement("li");
    item.textContent = suggestion;
    rewriteList.appendChild(item);
  }
}

function renderCleanerGaps(gaps, note) {
  if (!cleanerGaps) {
    return;
  }

  cleanerGaps.innerHTML = "";

  if (note) {
    const item = document.createElement("li");
    item.className = "cleaner-gaps-note";
    item.textContent = note;
    cleanerGaps.appendChild(item);
    cleanerGaps.hidden = false;
    return;
  }

  if (!gaps || gaps.length === 0) {
    cleanerGaps.hidden = true;
    return;
  }

  const heading = document.createElement("li");
  heading.className = "cleaner-gaps-heading";
  heading.textContent = "Removed empty claims. Fill these gaps yourself:";
  cleanerGaps.appendChild(heading);

  for (const gap of gaps) {
    const item = document.createElement("li");
    item.textContent = gap;
    cleanerGaps.appendChild(item);
  }

  cleanerGaps.hidden = false;
}

function renderCleanerDraft(result) {
  latestCleanerDraft = result.cleanerDraft || "";
  cleanerOutput.textContent = latestCleanerDraft || "No cleaner draft generated.";
  renderCleanerGaps(result.cleanerGaps, result.cleanerNote);
  useCleanerButton.disabled = !result.canApplyCleaner || !latestCleanerDraft;
  copyCleanerButton.disabled = !latestCleanerDraft;
  updateModelRewriteControls();
}

function axisColor(severity) {
  if (severity >= 80) {
    return "var(--red)";
  }

  if (severity >= 55) {
    return "var(--amber)";
  }

  if (severity >= 25) {
    return "var(--blue)";
  }

  return "var(--green)";
}

function renderAxes(axes, score, mode) {
  if (!axisList) {
    return;
  }

  axisList.innerHTML = "";

  if (axisTotalLabel) {
    axisTotalLabel.textContent = `${score} / 100`;
  }

  if (axisModeLabel) {
    axisModeLabel.textContent = mode === "code" ? "Code axes" : "Text axes";
  }

  if (!axes || axes.length === 0) {
    axisList.innerHTML = '<li class="empty-state">Run the scanner to see the breakdown.</li>';
    return;
  }

  for (const axis of [...axes].sort((a, b) => b.points - a.points)) {
    const item = document.createElement("li");
    item.className = "axis-item";
    item.innerHTML = `
      <div class="axis-top">
        <span class="axis-name">${escapeHtml(axis.label)}</span>
        <span class="axis-points">${axis.points} / ${axis.cap}</span>
      </div>
      <div class="axis-track"><div class="axis-fill"></div></div>
      <span class="axis-note">${escapeHtml(axis.note)}</span>
    `;
    const fill = item.querySelector(".axis-fill");
    fill.style.width = `${Math.max(axis.severity, axis.points > 0 ? 3 : 0)}%`;
    fill.style.background = axisColor(axis.severity);
    axisList.appendChild(item);
  }
}

function renderMetrics(metrics) {
  const labels = [metricOneLabel, metricTwoLabel, metricThreeLabel, metricFourLabel];
  const values = [clicheMetric, genericMetric, detailMetric, rhythmMetric];

  metrics.labels.forEach((label, index) => {
    labels[index].textContent = label;
    values[index].textContent = metrics.values[index];
  });
}

function renderEmptyState() {
  scoreRing.style.setProperty("--score", 0);
  scoreRing.style.setProperty("--ring-color", "var(--green)");
  scoreValue.textContent = "0";
  verdict.textContent = "Paste text to begin";
  scoreSummary.textContent =
    "The detector checks prose for generic phrasing and code for placeholder-heavy, inflated, or disconnected structure.";
  renderMetrics({
    labels: ["Markers", "Generic words", "Concrete detail", "Sentence sameness"],
    values: ["0", "0", "0%", "0%"]
  });
  renderAxes([], 0, "text");
  flagList.innerHTML = '<li class="empty-state">No flags yet.</li>';
  highlightOutput.textContent = "Paste text and run the scanner to see suspicious phrases highlighted.";
  latestCleanerDraft = "";
  cleanerOutput.textContent = "Run analysis to generate a cleaner draft.";
  useCleanerButton.disabled = true;
  copyCleanerButton.disabled = true;
  renderSuggestions([
    "For prose, replace abstract claims with specific people, numbers, dates, constraints, or tradeoffs.",
    "For code, resolve placeholders before polishing comments or naming."
  ]);
  updateModelRewriteControls();
}

function renderAnalysis() {
  const text = sourceText.value;
  const result = analyzeInput(text);

  if (!result) {
    renderEmptyState();
    return;
  }

  const verdictCopy = getVerdict(result.score, result.mode);
  scoreRing.style.setProperty("--score", result.score);
  scoreRing.style.setProperty("--ring-color", verdictCopy.color);
  scoreValue.textContent = result.score;
  verdict.textContent = verdictCopy.title;
  scoreSummary.textContent = verdictCopy.summary;
  renderMetrics(result.metrics);
  renderAxes(result.axes, result.score, result.mode);
  renderFlags(result.hits);
  renderHighlights(result.normalizedText || stripCodeFences(text.trim()), result.hits);
  renderSuggestions(result.suggestions);
  renderCleanerDraft(result);
}

// Same prompts the server uses, so a browser-direct Ollama call produces the
// same kind of rewrite. Kept in sync with api/_rewrite.py rewrite_messages.
function buildRewriteMessages(text, mode) {
  if (mode === "code") {
    return {
      system:
        "You revise code or code-adjacent text to remove AI slop. Preserve APIs, facts, and intent. " +
        "Do not invent missing dependencies. Remove placeholder naming, hollow comments, and unfinished scaffolding. " +
        "Return only the revised code or a concise repair plan if there is not enough context to safely rewrite it.",
      user: `Clean this code or repair plan. Return only the cleaned result:\n\n${text}`
    };
  }

  return {
    system:
      "You rewrite text to remove AI slop. Preserve the user's meaning and facts. " +
      "Do not invent sources, metrics, names, features, or outcomes. " +
      "Remove generic hype, bracket placeholders, empty quotes, excessive hyphens, and em-dash-heavy rhythm. " +
      "If the original is missing a specific detail, write a plain sentence that names the gap instead of using brackets. " +
      "Return only the cleaner replacement text.",
    user: `Rewrite this text so it sounds specific, plain, and usable:\n\n${text}`
  };
}

function stripModelWrapping(text) {
  const lines = String(text || "").trim().split("\n");
  if (lines[0] && lines[0].trim().startsWith("```")) {
    lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
  }
  return lines.join("\n").trim();
}

// Calls the visitor's own Ollama straight from the page. This is what lets the
// hosted demo use a local model: the request never touches our server, so
// "localhost" means the visitor's machine, not the server's.
async function ollamaBrowserRewrite(text, mode, settings) {
  const baseUrl = (settings.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
  const model = (settings.ollamaModel || "").trim();
  if (!model) {
    throw new Error("Enter an Ollama model name in Model settings.");
  }

  const { system, user } = buildRewriteMessages(text, mode);
  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.25 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
  } catch (networkError) {
    const origin = window.location.origin;
    throw new Error(
      `Could not reach Ollama at ${baseUrl}. Make sure it is running, and allow this page: ` +
        `OLLAMA_ORIGINS='${origin}' ollama serve (or OLLAMA_ORIGINS='*').`
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Ollama returned HTTP ${response.status}.`);
  }
  const content = stripModelWrapping(payload?.message?.content || payload?.response || "");
  if (!content) {
    throw new Error("Ollama did not return any text.");
  }
  return content;
}

async function generateModelRewrite() {
  const text = sourceText.value.trim();
  const settings = getModelSettings();

  if (!text) {
    renderEmptyState();
    return;
  }

  const result = analyzeInput(text);
  if (!result) {
    renderEmptyState();
    return;
  }

  renderAnalysis();
  setActiveTab("cleaner");

  if (settings.source === "local") {
    renderCleanerDraft(result);
    updateModelRewriteControls("Local draft refreshed.");
    return;
  }

  modelRewriteBusy = true;
  updateModelRewriteControls(`Sending text to ${getModelSourceLabel(settings)}...`);

  if (settings.source === "ollama" && settings.ollamaInBrowser !== false) {
    try {
      latestCleanerDraft = (await ollamaBrowserRewrite(text, result.mode, settings)).trim();
      cleanerOutput.textContent = latestCleanerDraft || "The model did not return a cleaner draft.";
      useCleanerButton.disabled = !result.canApplyCleaner || !latestCleanerDraft;
      copyCleanerButton.disabled = !latestCleanerDraft;
      modelRewriteBusy = false;
      updateModelRewriteControls("Generated with Ollama (in your browser).");
    } catch (error) {
      const fallbackDraft = result.cleanerDraft || "";
      latestCleanerDraft = fallbackDraft;
      cleanerOutput.textContent = `${error.message || "Ollama generation failed."}\n\nLocal draft:\n${
        fallbackDraft || "No local draft available."
      }`;
      useCleanerButton.disabled = !result.canApplyCleaner || !fallbackDraft;
      copyCleanerButton.disabled = !fallbackDraft;
      modelRewriteBusy = false;
      updateModelRewriteControls("Ollama generation failed. Showing local draft.");
    }
    return;
  }

  try {
    const response = await fetch("/api/rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        mode: result.mode,
        settings
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Rewrite failed with HTTP ${response.status}.`);
    }

    latestCleanerDraft = (payload.text || "").trim();
    cleanerOutput.textContent = latestCleanerDraft || "The model did not return a cleaner draft.";
    useCleanerButton.disabled = !result.canApplyCleaner || !latestCleanerDraft;
    copyCleanerButton.disabled = !latestCleanerDraft;
    modelRewriteBusy = false;
    updateModelRewriteControls(`Generated with ${payload.provider || getModelSourceLabel(settings)}.`);
  } catch (error) {
    const fallbackDraft = result.cleanerDraft || "";
    latestCleanerDraft = fallbackDraft;
    cleanerOutput.textContent = `${error.message || "Model generation failed."}\n\nLocal draft:\n${
      fallbackDraft || "No local draft available."
    }`;
    useCleanerButton.disabled = !result.canApplyCleaner || !fallbackDraft;
    copyCleanerButton.disabled = !fallbackDraft;
    modelRewriteBusy = false;
    updateModelRewriteControls("Model generation failed. Showing local draft.");
  }
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${tabName}Panel`);
  });
}

function setMode(mode) {
  selectedMode = mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  renderAnalysis();
}

analyzeButton.addEventListener("click", renderAnalysis);

sourceText.addEventListener("input", () => {
  updateModelRewriteControls();
  if (sourceText.value.trim().length > 80) {
    renderAnalysis();
  }
});

sampleSlopButton.addEventListener("click", () => {
  sourceText.value = SAMPLE_SLOP;
  setMode("text");
});

sampleCleanButton.addEventListener("click", () => {
  sourceText.value = SAMPLE_CLEAN;
  setMode("text");
});

sampleCodeButton.addEventListener("click", () => {
  sourceText.value = SAMPLE_CODE;
  setMode("code");
});

clearButton.addEventListener("click", () => {
  sourceText.value = "";
  sourceText.focus();
  renderEmptyState();
});

modelRewriteButton.addEventListener("click", generateModelRewrite);

useCleanerButton.addEventListener("click", () => {
  if (!latestCleanerDraft || useCleanerButton.disabled) {
    return;
  }

  sourceText.value = latestCleanerDraft;
  setMode("text");
  setActiveTab("flags");
});

copyCleanerButton.addEventListener("click", async () => {
  if (!latestCleanerDraft) {
    return;
  }

  try {
    await navigator.clipboard.writeText(latestCleanerDraft);
    copyCleanerButton.textContent = "Copied";
    window.setTimeout(() => {
      copyCleanerButton.textContent = "Copy";
    }, 1200);
  } catch {
    cleanerOutput.focus();
  }
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

window.addEventListener("model-settings-change", () => updateModelRewriteControls());

renderEmptyState();
