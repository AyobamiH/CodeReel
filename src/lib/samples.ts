import type { Language } from './types'

export const SAMPLES: Record<Language, string> = {
  typescript: `// Memoized fibonacci, the classic demo
const memo = new Map<number, number>();

export function fib(n: number): number {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n)!;

  const result = fib(n - 1) + fib(n - 2);
  memo.set(n, result);
  return result;
}

console.log(fib(42)); // 267914296`,

  javascript: `// Debounce any function
function debounce(fn, wait = 200) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const onResize = debounce(() => {
  console.log(window.innerWidth);
}, 100);

window.addEventListener("resize", onResize);`,

  python: `# Quicksort in three lines of logic
def quicksort(items):
    if len(items) <= 1:
        return items

    pivot, *rest = items
    small = [x for x in rest if x <= pivot]
    large = [x for x in rest if x > pivot]
    return quicksort(small) + [pivot] + quicksort(large)


print(quicksort([5, 2, 9, 1, 7]))  # [1, 2, 5, 7, 9]`,

  rust: `// Sum of squares, the iterator way
fn sum_of_squares(nums: &[i64]) -> i64 {
    nums.iter()
        .map(|n| n * n)
        .sum()
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5];
    let total = sum_of_squares(&nums);
    println!("total = {total}"); // total = 55
}`,

  go: `// Fan-in two channels
func merge(a, b <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for a != nil || b != nil {
            select {
            case v, ok := <-a:
                if !ok { a = nil; continue }
                out <- v
            case v, ok := <-b:
                if !ok { b = nil; continue }
                out <- v
            }
        }
    }()
    return out
}`,

  css: `/* Glassmorphism card */
.card {
  padding: 2rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
  transition: transform 200ms ease;
}

.card:hover {
  transform: translateY(-4px) scale(1.01);
}`,

  html: `<!-- Semantic hero section -->
<section class="hero">
  <hgroup>
    <h1>Ship faster</h1>
    <p>Animate your code in seconds.</p>
  </hgroup>

  <nav aria-label="Primary">
    <a href="/start" class="btn primary">Get started</a>
    <a href="/docs" class="btn ghost">Read the docs</a>
  </nav>
</section>`,

  json: `{
  "name": "codereel",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}`,

  bash: `#!/usr/bin/env bash
# Deploy in one shot
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Building $BRANCH..."
npm run build

echo "Deploying to production"
rsync -az dist/ deploy@prod:/var/www/app
echo "Done ✔"`,
}

/**
 * Default step snapshots for "Steps" mode. Each entry is the *full* code at that
 * stage; consecutive snapshots differ by lines inserted in the middle, which the
 * diff engine animates in. Titles double as slide captions.
 */
export const STEP_SAMPLE: { code: string; title: string }[] = [
  {
    title: 'The bare function',
    code: `function greet(name) {
  return \`Hello, \${name}\`
}`,
  },
  {
    title: 'Guard the empty case',
    code: `function greet(name) {
  if (!name) return 'Hello, stranger'
  return \`Hello, \${name}\`
}`,
  },
  {
    title: 'Log every greeting',
    code: `function greet(name) {
  if (!name) return 'Hello, stranger'
  const msg = \`Hello, \${name}\`
  console.log(msg)
  return msg
}`,
  },
]

