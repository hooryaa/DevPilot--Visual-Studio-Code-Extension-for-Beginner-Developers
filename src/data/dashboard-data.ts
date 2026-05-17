export type QuizTopic = keyof typeof dashboardData.practiceProblems;
export type QuizLevel = "easy" | "medium" | "hard";

export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  answer: number;
};

// Learning Resources - Single Source of Truth (SSOT)
export interface LearningResource {
  id: string;
  title: string;
  description: string;
  category: "learn" | "practice" | "quizzes" | "university" | "regional";
  type: "internal-quiz" | "external-link";
  topic?: string; // Language/topic identifier (typescript, python, javascript, react, sql, nodejs, etc.)
  difficulty?: "easy" | "medium" | "hard";
  url?: string;
  icon?: string;
}

export const learningResourcesRegistry: LearningResource[] = [
  // 📘 LEARN SECTION
  {
    id: "w3schools",
    title: "W3Schools",
    description: "Interactive tutorials on web technologies",
    category: "learn",
    type: "external-link",
    url: "https://www.w3schools.com",
    icon: "book",
  },
  {
    id: "tutorialspoint",
    title: "TutorialsPoint",
    description: "Comprehensive tutorials and quizzes",
    category: "learn",
    type: "external-link",
    url: "https://www.tutorialspoint.com",
    icon: "book",
  },
  {
    id: "studytonight",
    title: "StudyTonight",
    description: "Easy-to-follow programming lessons",
    category: "learn",
    type: "external-link",
    url: "https://www.studytonight.com",
    icon: "book",
  },
  {
    id: "javatpoint",
    title: "JavaTpoint",
    description: "Tutorials with interactive quizzes",
    category: "learn",
    type: "external-link",
    url: "https://www.javatpoint.com",
    icon: "book",
  },
  {
    id: "geeksforgeeks",
    title: "GeeksforGeeks Tutorials",
    description: "In-depth programming concepts and DSA",
    category: "learn",
    type: "external-link",
    url: "https://www.geeksforgeeks.org",
    icon: "book",
  },
  {
    id: "khan-academy",
    title: "Khan Academy (CS)",
    description: "University-level Computer Science resources",
    category: "learn",
    type: "external-link",
    url: "https://www.khanacademy.org/computing",
    icon: "book",
  },

  // 💻 PRACTICE SECTION
  {
    id: "hackerrank",
    title: "HackerRank",
    description: "Coding challenges and competitions",
    category: "practice",
    type: "external-link",
    url: "https://www.hackerrank.com",
    icon: "code",
  },
  {
    id: "leetcode",
    title: "LeetCode",
    description: "Algorithm problems for technical interviews",
    category: "practice",
    type: "external-link",
    url: "https://leetcode.com",
    icon: "code",
  },
  {
    id: "codeforces",
    title: "Codeforces",
    description: "Competitive programming challenges",
    category: "practice",
    type: "external-link",
    url: "https://codeforces.com",
    icon: "code",
  },
  {
    id: "geeksforgeeks-practice",
    title: "GeeksforGeeks Practice",
    description: "DSA and coding problem sets",
    category: "practice",
    type: "external-link",
    url: "https://practice.geeksforgeeks.org",
    icon: "code",
  },
  {
    id: "codesignal",
    title: "CodeSignal",
    description: "Interactive coding challenges and assessments",
    category: "practice",
    type: "external-link",
    url: "https://codesignal.com",
    icon: "code",
  },
  {
    id: "edabit",
    title: "Edabit",
    description: "Bite-sized coding challenges",
    category: "practice",
    type: "external-link",
    url: "https://edabit.com",
    icon: "code",
  },

  // 📝 INTERNAL QUIZZES + EXTERNAL QUIZ PLATFORMS
  {
    id: "quiz-html-easy",
    title: "HTML – Easy",
    description: "Basic HTML concepts and tags",
    category: "quizzes",
    type: "external-link",
    url: "https://www.w3schools.com/html/html_quiz.asp",
    icon: "lightbulb",
  },
  {
    id: "quiz-html-medium",
    title: "HTML – Medium",
    description: "Intermediate HTML challenges",
    category: "quizzes",
    type: "external-link",
    url: "https://www.tutorialspoint.com/html_online_quiz.htm",
    icon: "lightbulb",
  },
  {
    id: "quiz-css-easy",
    title: "CSS – Easy",
    description: "Basic CSS styling and properties",
    category: "quizzes",
    type: "external-link",
    url: "https://www.w3schools.com/css/css_quiz.asp",
    icon: "lightbulb",
  },
  {
    id: "quiz-css-hard",
    title: "CSS – Hard",
    description: "Advanced CSS layouts and techniques",
    category: "quizzes",
    type: "external-link",
    url: "https://www.geeksforgeeks.org/css-quiz/",
    icon: "lightbulb",
  },
  {
    id: "quiz-js-easy",
    title: "JavaScript – Easy",
    description: "JavaScript fundamentals",
    category: "quizzes",
    type: "external-link",
    url: "https://www.w3schools.com/js/js_quiz.asp",
    icon: "lightbulb",
  },
  {
    id: "quiz-js-medium",
    title: "JavaScript – Medium",
    description: "JavaScript core concepts and patterns",
    category: "quizzes",
    type: "external-link",
    url: "https://www.geeksforgeeks.org/javascript-quiz-set-1/",
    icon: "lightbulb",
  },

  // 🎓 UNIVERSITY ALIGNED
  {
    id: "freecodecamp",
    title: "freeCodeCamp",
    description: "Full-stack development curriculum",
    category: "university",
    type: "external-link",
    url: "https://www.freecodecamp.org",
    icon: "graduation-cap",
  },
  {
    id: "mit-ocw",
    title: "MIT OpenCourseWare (CS)",
    description: "MIT CS courses and materials",
    category: "university",
    type: "external-link",
    url: "https://ocw.mit.edu",
    icon: "graduation-cap",
  },
  {
    id: "coursera",
    title: "Coursera",
    description: "University-level online courses",
    category: "university",
    type: "external-link",
    url: "https://www.coursera.org",
    icon: "graduation-cap",
  },
  {
    id: "edx",
    title: "edX",
    description: "CS courses from top universities",
    category: "university",
    type: "external-link",
    url: "https://www.edx.org",
    icon: "graduation-cap",
  },

  // 🇵🇰 REGIONAL / HEC ALIGNED
  {
    id: "digiskills",
    title: "DigiSkills",
    description: "Pakistan's digital skills platform",
    category: "regional",
    type: "external-link",
    url: "https://digiskills.pk",
    icon: "globe",
  },
  {
    id: "hec",
    title: "HEC (Higher Education Commission – Pakistan)",
    description: "Higher Education Commission - Pakistan",
    category: "regional",
    type: "external-link",
    url: "https://www.hec.gov.pk",
    icon: "globe",
  },

  // 🔤 LANGUAGE-SPECIFIC RESOURCES (TypeScript)
  {
    id: "ts-handbook",
    title: "TypeScript Handbook",
    description: "Official TypeScript documentation and guide",
    category: "learn",
    type: "external-link",
    url: "https://www.typescriptlang.org/docs/",
    icon: "book",
    topic: "typescript",
  },
  {
    id: "ts-practice",
    title: "TypeScript Exercises",
    description: "Learn TypeScript through interactive exercises",
    category: "practice",
    type: "external-link",
    url: "https://typescript-exercises.github.io/",
    icon: "code",
    topic: "typescript",
  },
  {
    id: "ts-tutorial",
    title: "TypeScript Tutorial (GeeksforGeeks)",
    description: "Comprehensive TypeScript concepts explained",
    category: "learn",
    type: "external-link",
    url: "https://www.geeksforgeeks.org/typescript-tutorial/",
    icon: "book",
    topic: "typescript",
  },

  // 🐍 LANGUAGE-SPECIFIC RESOURCES (Python)
  {
    id: "python-docs",
    title: "Python Official Documentation",
    description: "Official Python documentation and tutorials",
    category: "learn",
    type: "external-link",
    url: "https://docs.python.org/3/",
    icon: "book",
    topic: "python",
  },
  {
    id: "python-practice",
    title: "Python Practice (HackerRank)",
    description: "Python coding challenges on HackerRank",
    category: "practice",
    type: "external-link",
    url: "https://www.hackerrank.com/domains/python",
    icon: "code",
    topic: "python",
  },
  {
    id: "python-tutor",
    title: "Real Python",
    description: "In-depth Python tutorials and articles",
    category: "learn",
    type: "external-link",
    url: "https://realpython.com/",
    icon: "book",
    topic: "python",
  },

  // JavaScript Extended
  {
    id: "js-mdn",
    title: "MDN Web Docs - JavaScript",
    description: "Comprehensive JavaScript reference",
    category: "learn",
    type: "external-link",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    icon: "book",
    topic: "javascript",
  },
  {
    id: "async-await",
    title: "Async/Await Guide",
    description: "Master asynchronous JavaScript",
    category: "learn",
    type: "external-link",
    url: "https://javascript.info/async-await",
    icon: "book",
    topic: "javascript",
  },

  // React/Frontend
  {
    id: "react-docs",
    title: "React Official Documentation",
    description: "React library documentation and guides",
    category: "learn",
    type: "external-link",
    url: "https://react.dev",
    icon: "book",
    topic: "react",
  },
  {
    id: "react-patterns",
    title: "React Patterns",
    description: "Common React patterns and best practices",
    category: "learn",
    type: "external-link",
    url: "https://reactpatterns.com",
    icon: "book",
    topic: "react",
  },

  // Database & Backend
  {
    id: "sql-tutorial",
    title: "SQL Tutorial (W3Schools)",
    description: "Complete SQL guide for databases",
    category: "learn",
    type: "external-link",
    url: "https://www.w3schools.com/sql/",
    icon: "book",
    topic: "sql",
  },
  {
    id: "nodejs-docs",
    title: "Node.js Documentation",
    description: "Official Node.js API and guides",
    category: "learn",
    type: "external-link",
    url: "https://nodejs.org/docs/",
    icon: "book",
    topic: "nodejs",
  },

  // ☕ LANGUAGE-SPECIFIC RESOURCES (Java)
  {
    id: "java-docs",
    title: "Java Official Documentation",
    description: "Official Java SE documentation",
    category: "learn",
    type: "external-link",
    url: "https://docs.oracle.com/javase/",
    icon: "book",
    topic: "java",
  },
  {
    id: "java-tutorials",
    title: "Java Tutorials (Oracle)",
    description: "Comprehensive Java learning resources",
    category: "learn",
    type: "external-link",
    url: "https://docs.oracle.com/javase/tutorial/",
    icon: "book",
    topic: "java",
  },
  {
    id: "java-practice",
    title: "Java Coding Challenges",
    description: "HackerRank Java coding problems",
    category: "practice",
    type: "external-link",
    url: "https://www.hackerrank.com/domains/java",
    icon: "code",
    topic: "java",
  },

  // 🦀 LANGUAGE-SPECIFIC RESOURCES (Rust)
  {
    id: "rust-book",
    title: "The Rust Book",
    description: "Official Rust programming book",
    category: "learn",
    type: "external-link",
    url: "https://doc.rust-lang.org/book/",
    icon: "book",
    topic: "rust",
  },
  {
    id: "rust-docs",
    title: "Rust Standard Library Docs",
    description: "Rust standard library documentation",
    category: "learn",
    type: "external-link",
    url: "https://doc.rust-lang.org/std/",
    icon: "book",
    topic: "rust",
  },

  // 🐹 LANGUAGE-SPECIFIC RESOURCES (Go)
  {
    id: "go-docs",
    title: "Go Official Documentation",
    description: "Go programming language documentation",
    category: "learn",
    type: "external-link",
    url: "https://golang.org/doc/",
    icon: "book",
    topic: "go",
  },

  // #️⃣ LANGUAGE-SPECIFIC RESOURCES (C#)
  {
    id: "csharp-docs",
    title: "C# Documentation (Microsoft)",
    description: "Official Microsoft C# documentation",
    category: "learn",
    type: "external-link",
    url: "https://docs.microsoft.com/en-us/dotnet/csharp/",
    icon: "book",
    topic: "csharp",
  },

  // ➕ LANGUAGE-SPECIFIC RESOURCES (C++)
  {
    id: "cpp-reference",
    title: "C++ Reference",
    description: "Comprehensive C++ language reference",
    category: "learn",
    type: "external-link",
    url: "https://en.cppreference.com/w/",
    icon: "book",
    topic: "cpp",
  },

  // 🎨 LANGUAGE-SPECIFIC RESOURCES (CSS)
  {
    id: "css-docs",
    title: "CSS Documentation (MDN)",
    description: "Comprehensive CSS reference and guides",
    category: "learn",
    type: "external-link",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
    icon: "book",
    topic: "css",
  },
  {
    id: "css-tricks",
    title: "CSS-Tricks",
    description: "Practical CSS articles and tutorials",
    category: "learn",
    type: "external-link",
    url: "https://css-tricks.com/",
    icon: "book",
    topic: "css",
  },

  // 📝 LANGUAGE-SPECIFIC RESOURCES (HTML)
  {
    id: "html-spec",
    title: "HTML Living Standard",
    description: "Official HTML specification",
    category: "learn",
    type: "external-link",
    url: "https://html.spec.whatwg.org/",
    icon: "book",
    topic: "html",
  },
  {
    id: "html-mdn",
    title: "HTML Guide (MDN)",
    description: "Comprehensive HTML documentation",
    category: "learn",
    type: "external-link",
    url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
    icon: "book",
    topic: "html",
  },
  {
    id: "html-semantic",
    title: "Semantic HTML Best Practices",
    description: "Learn semantic HTML structure",
    category: "learn",
    type: "external-link",
    url: "https://www.w3schools.com/html/html5_semantic_elements.asp",
    icon: "book",
    topic: "html",
  },

  // 🐍 LANGUAGE-SPECIFIC RESOURCES (Python)
  {
    id: "python-docs",
    title: "Python Official Documentation",
    description: "Official Python documentation",
    category: "learn",
    type: "external-link",
    url: "https://docs.python.org/3/",
    icon: "book",
    topic: "python",
  },
  {
    id: "python-tutorial",
    title: "Python for Beginners",
    description: "Comprehensive Python beginner tutorial",
    category: "learn",
    type: "external-link",
    url: "https://www.w3schools.com/python/",
    icon: "book",
    topic: "python",
  },
  {
    id: "python-practice",
    title: "Python Coding Challenges",
    description: "LeetCode Python programming problems",
    category: "practice",
    type: "external-link",
    url: "https://leetcode.com/problemset/?difficulty=EASY&topicTags=class-0",
    icon: "code",
    topic: "python",
  },
  {
    id: "python-datacamp",
    title: "DataCamp Python Courses",
    description: "Interactive Python Data Science courses",
    category: "learn",
    type: "external-link",
    url: "https://www.datacamp.com/courses/intro-to-python-for-data-science",
    icon: "book",
    topic: "python",
  },

  // 🎯 FOCUSED PRACTICE BY DIFFICULTY
  {
    id: "dsa-easy",
    title: "DSA – Easy Problems",
    description: "Easy data structures and algorithms",
    category: "practice",
    type: "external-link",
    url: "https://leetcode.com/problemset/?difficulty=EASY",
    icon: "code",
    difficulty: "easy",
  },
  {
    id: "dsa-medium",
    title: "DSA – Medium Problems",
    description: "Intermediate DSA challenges",
    category: "practice",
    type: "external-link",
    url: "https://leetcode.com/problemset/?difficulty=MEDIUM",
    icon: "code",
    difficulty: "medium",
  },
  {
    id: "dsa-hard",
    title: "DSA – Hard Problems",
    description: "Advanced algorithm problems",
    category: "practice",
    type: "external-link",
    url: "https://leetcode.com/problemset/?difficulty=HARD",
    icon: "code",
    difficulty: "hard",
  },
];

export const dashboardData = {
  user: {
    name: "Hooria",
    role: "Student Developer",
    activeTrack: "Web Development",
    avatar: "https://via.placeholder.com/150",
    level: 1,
  },

  progress: {
    completedLessons: 8,
    totalLessons: 20,
    streak: 4,
  },

  recentActivity: [
    { id: 1, title: "HTML Basics", time: "2 hours ago" },
    { id: 2, title: "CSS Flexbox", time: "Yesterday" },
  ],

  quickActions: [
    { id: "learn", label: "Continue Learning" },
    { id: "chat", label: "Open Chat" },
    { id: "commit", label: "Generate Commit" },
    { id: "todo", label: "TODO Tracker" },
  ],

  recentAchievements: [
    { title: "Code Reviewer", icon: "Star", color: "text-yellow-400" },
    { title: "Bug Hunter", icon: "Target", color: "text-red-400" },
    { title: "Fast Learner", icon: "Zap", color: "text-blue-400" },
  ],

  // 🔥 Practice Problems / Quizzes
practiceProblems: {
  html: {
    easy: [
      {
        id: 1,
        question: "Which tag defines a hyperlink?",
        options: ["<link>", "<a>", "<href>", "<hyper>"],
        answer: 1,
      },
      {
        id: 2,
        question: "Which tag creates a line break?",
        options: ["<break>", "<lb>", "<br>", "<newline>"],
        answer: 2,
      },
    ],
    medium: [
      {
        id: 1,
        question: "Which attribute specifies an image source?",
        options: ["src", "href", "alt", "link"],
        answer: 0,
      },
      {
        id: 2,
        question: "Which tag is used for creating a table row?",
        options: ["<td>", "<tr>", "<th>", "<row>"],
        answer: 1,
      },
    ],
  },

  css: {
    easy: [
      {
        id: 1,
        question: "Which property controls text size?",
        options: ["font-style", "text-size", "font-size", "size"],
        answer: 2,
      },
      {
        id: 2,
        question: "Which property sets background color?",
        options: ["color", "background-color", "bg", "fill"],
        answer: 1,
      },
    ],
    hard: [
      {
        id: 1,
        question: "Which CSS layout module provides flexible box layouts?",
        options: ["Grid", "Flexbox", "Float", "Inline-block"],
        answer: 1,
      },
      {
        id: 2,
        question: "Which property defines the stacking order of elements?",
        options: ["z-index", "order", "stack", "layer"],
        answer: 0,
      },
    ],
  },

  js: {
    easy: [
      {
        id: 1,
        question: "Which keyword declares a constant?",
        options: ["let", "var", "const", "static"],
        answer: 2,
      },
      {
        id: 2,
        question: "Which method converts JSON string to object?",
        options: [
          "JSON.parse()",
          "JSON.stringify()",
          "Object.fromJSON()",
          "JSON.toObject()",
        ],
        answer: 0,
      },
    ],
    medium: [
      {
        id: 1,
        question: "Which operator checks both value and type?",
        options: ["==", "===", "!=", "!=="],
        answer: 1,
      },
      {
        id: 2,
        question: "Which method adds an element to the end of an array?",
        options: ["push()", "pop()", "shift()", "unshift()"],
        answer: 0,
      },
    ],
  },
},
};

// Helper function to get resources by category
export function getResourcesByCategory(category: LearningResource["category"]): LearningResource[] {
  return learningResourcesRegistry.filter(r => r.category === category);
}

// Helper function to get resources by language/topic
export function getResourcesByLanguage(language: string): LearningResource[] {
  return learningResourcesRegistry.filter(r => r.topic?.toLowerCase() === language.toLowerCase());
}

// Helper function to get all available languages
export function getAvailableLanguages(): string[] {
  const languages = new Set(learningResourcesRegistry.map(r => r.topic).filter(Boolean));
  return Array.from(languages) as string[];
}

// Helper function to get resource by ID
export function getResourceById(id: string): LearningResource | undefined {
  return learningResourcesRegistry.find(r => r.id === id);
}

// Helper to convert resource ID to feature name for RightDashboard
export function resourceToFeatureName(resource: LearningResource): string {
  if (resource.type === "internal-quiz") {
    return `quiz-${resource.topic}-${resource.difficulty}`;
  }
  return resource.id;
}