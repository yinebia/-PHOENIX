import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

/**
 * Phase 0 Dirty Dozen Security Rule Verification Spec
 * Verifies static rule invariants in firestore.rules and validates the
 * 12 adversarial attack vectors from security_spec.md against rule structure.
 * Note: Live Firestore Emulator is not bundled in this container; live
 * server-side ownership & ID-changing attack tests are run against Express
 * endpoints in our live E2E test suite.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

const dirtyDozenChecks = [
  {
    name: '1. Global default-deny safety net present first',
    check: () => /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/.test(rules),
  },
  {
    name: '2. Cross-tenant list scraping blocked (no blanket isSignedIn list)',
    check: () =>
      /match \/users\/\{userId\}[\s\S]*allow list: if false;/.test(rules) &&
      /allow list: if isValidId\(userId\) && isVerifiedOwner\(userId\) && existing\(\)\.ownerId == request\.auth\.uid;/.test(rules),
  },
  {
    name: '3. Identity spoofing prevented (ownerId == request.auth.uid && == userId)',
    check: () =>
      rules.includes('data.ownerId == userId') &&
      rules.includes('incoming().ownerId == request.auth.uid'),
  },
  {
    name: '4. Ghost / shadow field injection prevented via hasOnly + affectedKeys',
    check: () =>
      rules.includes('data.keys().hasAll(') &&
      rules.includes('data.keys().hasOnly(') &&
      rules.includes('affectedKeys().hasOnly('),
  },
  {
    name: '5. Privilege escalation blocked (role forced to customer & /admins locked)',
    check: () =>
      rules.includes("data.role == 'customer'") &&
      /match \/admins\/\{adminUid\}[\s\S]*allow list, create, update, delete: if false;/.test(rules),
  },
  {
    name: '6. Unverified email spoof attack blocked (email_verified == true required)',
    check: () => rules.includes('request.auth.token.email_verified == true'),
  },
  {
    name: '7. ID poisoning / denial-of-wallet prevented (isValidId + max size limits)',
    check: () =>
      rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')") &&
      rules.includes('data.content.size() <= 500000') &&
      rules.includes('data.goal.size() <= 4000'),
  },
  {
    name: '8. Orphaned file injection prevented via Master Gate exists()/existsAfter()',
    check: () =>
      rules.includes('exists(/databases/$(database)/documents/users/$(userId)/missions/$(missionId))'),
  },
  {
    name: '9. Immutable fields protected (id, ownerId, goal, createdAt)',
    check: () =>
      rules.includes('incoming().ownerId == existing().ownerId') &&
      rules.includes('incoming().goal == existing().goal') &&
      rules.includes('incoming().createdAt == existing().createdAt'),
  },
  {
    name: '10. Client timestamp spoofing blocked (request.time enforced)',
    check: () =>
      rules.includes('incoming().createdAt == request.time') &&
      rules.includes('incoming().updatedAt == request.time'),
  },
  {
    name: '11. Terminal state rewriting locked (completed / cancelled missions)',
    check: () =>
      rules.includes("!(existing().status in ['completed', 'cancelled'])") &&
      rules.includes("existing().status in ['completed', 'cancelled']"),
  },
  {
    name: '12. List & map size poisoning guarded',
    check: () =>
      rules.includes('data.tasks.size() <= 20') &&
      rules.includes('data.logs.size() <= 250') &&
      rules.includes('data.artifactsSummary.size() <= 30'),
  },
];

for (const item of dirtyDozenChecks) {
  assert.ok(item.check(), `FAILED: ${item.name}`);
  console.log(`PASS: ${item.name}`);
}
console.log('All 12 Dirty Dozen structural assertions passed on firestore.rules.');
