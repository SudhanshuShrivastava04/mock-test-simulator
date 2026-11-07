// ─────────────────────────────────────────────────────────────
//  TEST CONFIG + QUESTION BANK
//  This file lives outside /public, so it is never served to the
//  browser. Answers stay on the server; the test page only gets
//  questions and options.
// ─────────────────────────────────────────────────────────────

import { DSA1, DSA2, DSA3, SQLQ1, SQLQ2 } from "./set2.js";

export const CONFIG = {
  title: "CS Fundamentals & DSA Assessment",
  durationMinutes: 120,       // total time for Set 1 + Set 2
  set1MarkPerQuestion: 1,
  set1NegativeMark: 0,        // e.g. 0.25 for negative marking
  showScoreToCandidate: false // true = brother sees his Set 1 score after submitting
};

// ── SET 1: MCQs ── answer = index of the correct option (0-based)
export const SET1 = [
  // ── OOPs ─────────────────────────────────────────────
  {
    id: "oop1", topic: "OOPs",
    q: "Which concept lets a parent-class reference call the child class's version of a method, decided at runtime?",
    options: ["Encapsulation", "Method overloading", "Method overriding (runtime polymorphism)", "Abstraction"],
    answer: 2,
    why: "Overriding + dynamic dispatch picks the method based on the actual object type at runtime. Overloading is resolved at compile time."
  },
  {
    id: "oop2", topic: "OOPs",
    q: "What does this C++ program print?",
    code: `class Base {
public:
    virtual void show() { cout << "Base"; }
};
class Derived : public Base {
public:
    void show() { cout << "Derived"; }
};
int main() {
    Base* b = new Derived();
    b->show();
}`,
    options: ["Base", "Derived", "BaseDerived", "Compilation error"],
    answer: 1,
    why: "show() is virtual, so the call is dispatched through the vtable to Derived::show(). Without 'virtual' it would print Base."
  },
  {
    id: "oop3", topic: "OOPs",
    q: "In Java (8 and later), which statement about abstract classes and interfaces is TRUE?",
    options: [
      "An interface can have instance variables that each object stores separately",
      "An abstract class can have a constructor; an interface cannot",
      "A class can extend two abstract classes",
      "An abstract class cannot contain any concrete (implemented) methods"
    ],
    answer: 1,
    why: "Abstract classes can declare constructors (called via super()). Interface fields are implicitly public static final, and Java allows only single class inheritance."
  },
  {
    id: "oop4", topic: "OOPs",
    q: "Classes B and C both inherit from A, and D inherits from both B and C. In C++, what prevents D from holding two copies of A?",
    options: ["Declaring A as abstract", "Virtual inheritance (class B : virtual public A)", "Making A's members private", "Using friend classes"],
    answer: 1,
    why: "This is the diamond problem. Virtual inheritance makes B and C share a single A subobject inside D."
  },
  {
    id: "oop5", topic: "OOPs",
    q: "Which of these is NOT a valid way to overload a method?",
    options: [
      "Changing the number of parameters",
      "Changing the types of parameters",
      "Changing the order of parameter types",
      "Changing only the return type"
    ],
    answer: 3,
    why: "The compiler picks an overload by its argument list. Two methods that differ only in return type are ambiguous at the call site, so it's a compile error."
  },
  {
    id: "oop6", topic: "OOPs",
    q: "A Car object creates its own Engine object, and the Engine is destroyed when the Car is destroyed. Which relationship is this?",
    options: ["Inheritance (is-a)", "Aggregation (weak has-a)", "Composition (strong has-a)", "Association with no ownership"],
    answer: 2,
    why: "Composition means the part's lifetime is owned by the whole. In aggregation the part can exist independently."
  },
  {
    id: "oop7", topic: "OOPs",
    q: "Which statement about constructors in Java is correct?",
    options: [
      "A constructor can be overridden in a subclass",
      "A constructor can be overloaded but cannot be overridden",
      "A constructor must always have a return type of void",
      "A constructor can be declared abstract"
    ],
    answer: 1,
    why: "Constructors aren't inherited, so they can't be overridden. A class can define several constructors with different parameters (overloading)."
  },

  // ── Analysis of Algorithms ───────────────────────────
  {
    id: "algo1", topic: "Analysis of Algorithms",
    q: "What is the time complexity of this code?",
    code: `for (int i = 1; i < n; i *= 2) {
    for (int j = 0; j < n; j++) {
        count++;
    }
}`,
    options: ["O(n)", "O(log n)", "O(n log n)", "O(n²)"],
    answer: 2,
    why: "The outer loop doubles i, so it runs about log n times. The inner loop runs n times for each, giving n log n."
  },
  {
    id: "algo2", topic: "Analysis of Algorithms",
    q: "What is the time complexity of this loop?",
    code: `for (int i = 1; i * i <= n; i++) {
    sum += i;
}`,
    options: ["O(log n)", "O(√n)", "O(n)", "O(n / 2)"],
    answer: 1,
    why: "The loop stops when i² > n, i.e. after about √n iterations."
  },
  {
    id: "algo3", topic: "Analysis of Algorithms",
    q: "Using the Master Theorem, solve T(n) = 4T(n/2) + n.",
    options: ["Θ(n)", "Θ(n log n)", "Θ(n²)", "Θ(n² log n)"],
    answer: 2,
    why: "a = 4, b = 2, so n^(log₂4) = n². Since f(n) = n grows slower than n², case 1 applies: Θ(n²)."
  },
  {
    id: "algo4", topic: "Analysis of Algorithms",
    q: "What is the time complexity of the naive recursive Fibonacci, fib(n) = fib(n-1) + fib(n-2)?",
    options: ["O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"],
    answer: 3,
    why: "Each call branches into two, and subproblems are recomputed. The tight bound is about O(1.618ⁿ), which is within O(2ⁿ)."
  },
  {
    id: "algo5", topic: "Analysis of Algorithms",
    q: "What is the best-case time complexity of insertion sort, and when does it happen?",
    options: [
      "O(n log n), when the array is random",
      "O(n), when the array is already sorted",
      "O(n²), when the array is reverse sorted",
      "O(1), when the array has one distinct value"
    ],
    answer: 1,
    why: "On sorted input each element is compared once with its left neighbour and never shifted, so the total work is linear."
  },
  {
    id: "algo6", topic: "Analysis of Algorithms",
    q: "Which ordering goes from slowest-growing to fastest-growing?",
    options: [
      "√n < log n < n log n < n² < 2ⁿ",
      "log n < √n < n log n < n² < 2ⁿ",
      "log n < n log n < √n < 2ⁿ < n²",
      "√n < log n < n² < n log n < 2ⁿ"
    ],
    answer: 1,
    why: "Any logarithm grows slower than any positive power of n, so log n < √n. Every polynomial grows slower than 2ⁿ."
  },
  {
    id: "algo7", topic: "Analysis of Algorithms",
    q: "A dynamic array doubles its capacity when full. What is the amortized cost of one push_back?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    answer: 0,
    why: "Total copying over n pushes is 1 + 2 + 4 + … + n < 2n, so spread across n operations it averages to a constant."
  },

  // ── Aptitude ─────────────────────────────────────────
  {
    id: "apt1", topic: "Aptitude",
    q: "A 150 m long train passes a pole in 15 seconds. How long will it take to cross a 300 m long platform?",
    options: ["30 seconds", "35 seconds", "45 seconds", "50 seconds"],
    answer: 2,
    why: "Speed = 150/15 = 10 m/s. To cross the platform it covers 150 + 300 = 450 m, so 450/10 = 45 s."
  },
  {
    id: "apt2", topic: "Aptitude",
    q: "Pipe A fills a tank in 12 hours and pipe B in 15 hours. Pipe C empties the full tank in 20 hours. If all three are opened together on an empty tank, when will it be full?",
    options: ["8 hours", "10 hours", "12 hours", "15 hours"],
    answer: 1,
    why: "Net rate = 1/12 + 1/15 − 1/20 = (5 + 4 − 3)/60 = 1/10 per hour, so 10 hours."
  },
  {
    id: "apt3", topic: "Aptitude",
    q: "A seller marks an item 40% above cost price and then gives a 20% discount. What is the profit percentage?",
    options: ["8%", "12%", "20%", "16%"],
    answer: 1,
    why: "Selling price = 1.4 × 0.8 = 1.12 × cost price, so 12% profit."
  },
  {
    id: "apt4", topic: "Aptitude",
    q: "Two fair dice are rolled. What is the probability that the sum is 8?",
    options: ["1/6", "5/36", "1/9", "7/36"],
    answer: 1,
    why: "Favourable outcomes: (2,6), (3,5), (4,4), (5,3), (6,2) = 5 out of 36."
  },
  {
    id: "apt5", topic: "Aptitude",
    q: "What is the difference between compound interest (compounded yearly) and simple interest on ₹10,000 for 2 years at 10% per annum?",
    options: ["₹0", "₹100", "₹200", "₹210"],
    answer: 1,
    why: "SI = 10,000 × 0.1 × 2 = ₹2,000. CI = 10,000 × (1.1² − 1) = ₹2,100. Difference = ₹100."
  },
  {
    id: "apt6", topic: "Aptitude",
    q: "Find the next number in the series: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "48"],
    answer: 1,
    why: "The terms are n(n+1): 1×2, 2×3, 3×4, 4×5, 5×6, so next is 6×7 = 42. Differences also go +4, +6, +8, +10, +12."
  },
  {
    id: "apt7", topic: "Aptitude",
    q: "A company's monthly orders grew by 25% in March and then fell by 20% in April. Compared to February, April's orders are:",
    options: ["5% higher", "5% lower", "Exactly the same", "2% higher"],
    answer: 2,
    why: "1.25 × 0.80 = 1.00, so April equals February."
  },

  // ── SQL Joins & Functions ────────────────────────────
  {
    id: "sql1", topic: "SQL Joins & Functions",
    q: "Table A has 5 rows and table B has 4 rows. How many rows does SELECT * FROM A CROSS JOIN B return?",
    options: ["9", "5", "20", "4"],
    answer: 2,
    why: "A cross join is a Cartesian product: 5 × 4 = 20 rows."
  },
  {
    id: "sql2", topic: "SQL Joins & Functions",
    q: "Table A has column x with values (1, 1, 2, NULL). Table B has column x with values (1, 2, 2, NULL). How many rows does A INNER JOIN B ON A.x = B.x return?",
    options: ["3", "4", "5", "6"],
    answer: 1,
    why: "Two 1s in A × one 1 in B = 2 rows. One 2 in A × two 2s in B = 2 rows. NULL = NULL is not true, so NULLs never match. Total 4."
  },
  {
    id: "sql3", topic: "SQL Joins & Functions",
    q: "Same tables as before: A.x = (1, 1, 2, NULL), B.x = (1, 2, 2, NULL). How many rows does A LEFT JOIN B ON A.x = B.x return?",
    options: ["4", "5", "6", "8"],
    answer: 1,
    why: "The 4 matching rows, plus A's NULL row which has no match and is kept with NULLs on B's side. Total 5."
  },
  {
    id: "sql4", topic: "SQL Joins & Functions",
    q: "Column val has the values (10, NULL, 20, NULL, 30). What does SELECT COUNT(*), COUNT(val), AVG(val) return?",
    options: ["5, 5, 12", "5, 3, 20", "3, 3, 20", "5, 3, 12"],
    answer: 1,
    why: "COUNT(*) counts all rows (5). COUNT(val) and AVG(val) skip NULLs: 3 values averaging 60/3 = 20."
  },
  {
    id: "sql5", topic: "SQL Joins & Functions",
    q: "Which query correctly lists departments that have more than 5 employees?",
    options: [
      "SELECT dept FROM emp WHERE COUNT(*) > 5 GROUP BY dept;",
      "SELECT dept FROM emp GROUP BY dept HAVING COUNT(*) > 5;",
      "SELECT dept FROM emp GROUP BY dept WHERE COUNT(*) > 5;",
      "SELECT dept, COUNT(*) > 5 FROM emp;"
    ],
    answer: 1,
    why: "WHERE filters rows before grouping and can't use aggregates. HAVING filters groups after GROUP BY."
  },
  {
    id: "sql6", topic: "SQL Joins & Functions",
    q: "Salaries are (100, 100, 90), ordered highest first. What value does RANK() OVER (ORDER BY salary DESC) give to 90?",
    options: ["1", "2", "3", "NULL"],
    answer: 2,
    why: "Both 100s get rank 1, and RANK() skips the next position, so 90 gets 3. DENSE_RANK() would give 2 and ROW_NUMBER() always gives 3."
  },
  {
    id: "sql7", topic: "SQL Joins & Functions",
    q: "What does SELECT COALESCE(NULL, NULL, 'Meesho', 'Flipkart') return?",
    options: ["NULL", "'Meesho'", "'Flipkart'", "An error, because of multiple arguments"],
    answer: 1,
    why: "COALESCE returns the first non-NULL argument in the list."
  }
];

// ── SET 2: coding (auto-tested in the browser, marks given by you) + one written case ──
// The coding questions live in set2.js; their tests in set2-tests.js.
export const SET2 = [
  DSA1, DSA2, DSA3, SQLQ1, SQLQ2,
  { id: "case1", type: "Business case", marks: 10, title: "Business Case Study", link: "", prompt: "Question to be added." }
];

// What the test page is allowed to see (no answers, no explanations)
export function publicPaper() {
  return {
    config: {
      title: CONFIG.title,
      durationMinutes: CONFIG.durationMinutes,
      set1MarkPerQuestion: CONFIG.set1MarkPerQuestion,
      set1NegativeMark: CONFIG.set1NegativeMark
    },
    set1: SET1.map(({ id, topic, q, code, options }) => ({ id, topic, q, code: code || null, options })),
    // `link` (the original source) stays server-side for coding questions, so the candidate
    // isn't one click away from published solutions.
    set2: SET2.map(({ id, type, marks, title, link, prompt, coding }) =>
      coding ? { id, type, marks, title, prompt, coding } : { id, type, marks, title, link, prompt })
  };
}

// Grade Set 1 on the server
export function gradeSet1(answers = {}) {
  let score = 0;
  const byTopic = {};
  const detail = SET1.map((item) => {
    const raw = answers[item.id];
    const chosen = Number.isInteger(raw) && raw >= 0 && raw < item.options.length ? raw : null;
    const correct = chosen === item.answer;
    const t = (byTopic[item.topic] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 });
    t.total++;
    if (chosen === null) t.skipped++;
    else if (correct) { t.correct++; score += CONFIG.set1MarkPerQuestion; }
    else { t.wrong++; score -= CONFIG.set1NegativeMark; }
    return { id: item.id, chosen, correct };
  });
  return {
    score: Math.round(score * 100) / 100,
    max: SET1.length * CONFIG.set1MarkPerQuestion,
    byTopic,
    detail
  };
}
