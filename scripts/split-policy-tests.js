const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '../tests/api/policy-evaluation-edge.spec.ts');
const content = fs.readFileSync(sourceFile, 'utf8');

// Split at line ~160 (after confidence/edge tests, before drift tests)
const lines = content.split('\n');

// Find the split point (after "should handle edge at exact threshold (0.05)" test)
let splitIndex = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("should handle undefined drift")) {
    splitIndex = i - 2; // Start of that test block
    break;
  }
}

if (splitIndex === 0) splitIndex = 155; // Fallback

// Create first file: confidence and edge tests
const part1Lines = lines.slice(0, splitIndex);
const part1Content = part1Lines.join('\n');
const part1Path = path.join(__dirname, '../tests/api/policy-confidence-edge.spec.ts');

// Update the describe block for part 1
const part1Final = part1Content.replace(
  "test.describe('Policy Evaluation Edge Cases - P1 @p1 @api @policy @edge-cases', () => {",
  "test.describe('Policy Evaluation - Confidence & Edge Gates @p1 @api @policy @edge-cases', () => {"
);

fs.writeFileSync(part1Path, part1Final, 'utf8');
console.log(`✅ Created: ${part1Path} (${part1Lines.length} lines)`);

// Create second file: drift and kelly tests
const part2Header = lines.slice(0, 11).join('\n'); // Imports and setup
const part2Lines = lines.slice(splitIndex);
const part2Content = part2Header + '\n' + part2Lines.join('\n');
const part2Path = path.join(__dirname, '../tests/api/policy-drift-kelly.spec.ts');

// Update the describe block for part 2
const part2Final = part2Content.replace(
  "test.describe('Policy Evaluation Edge Cases - P1 @p1 @api @policy @edge-cases', () => {",
  "test.describe('Policy Evaluation - Drift & Kelly Gates @p1 @api @policy @edge-cases', () => {"
);

fs.writeFileSync(part2Path, part2Final, 'utf8');
console.log(`✅ Created: ${part2Path} (${part2Lines.length + 11} lines)`);

// Backup original file
const backupPath = path.join(__dirname, '../tests/api/policy-evaluation-edge.spec.ts.backup');
fs.copyFileSync(sourceFile, backupPath);
console.log(`💾 Backup created: ${backupPath}`);

// Remove original file
fs.unlinkSync(sourceFile);
console.log(`🗑️ Removed: ${sourceFile}`);

console.log('');
console.log('📊 Split Summary:');
console.log(`- Part 1 (Confidence & Edge): ${part1Lines.length} lines`);
console.log(`- Part 2 (Drift & Kelly): ${part2Lines.length + 11} lines`);
console.log(`- Total: ${part1Lines.length + part2Lines.length + 11} lines (was ${lines.length})`);
