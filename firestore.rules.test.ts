import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateFirestorePayload } from './src/lib/validation.ts';

test('Dirty Dozen #1: Self-assigned admin role on publicProfile creation is rejected', () => {
  const res = validateFirestorePayload('publicProfiles', {
    uid: 'user_abc',
    username: 'hacker',
    displayName: 'Hacker',
    role: 'admin',
    isPublic: true,
    isSuspended: false,
    followersCount: 0,
    followingCount: 0,
  });
  assert.equal(res.ok, false);
});

test('Dirty Dozen #2: Shadow field injection on favorites is rejected', () => {
  const res = validateFirestorePayload('favorites', {
    id: 'fav_1',
    userId: 'user_abc',
    itemId: '123',
    itemType: 'anime',
    title: 'Frieren',
    isAdminOverride: true,
  });
  assert.equal(res.ok, false);
});

test('Dirty Dozen #6: ID Poisoning on publicProfiles is rejected', () => {
  const res = validateFirestorePayload('publicProfiles', {
    uid: '../admins/hacker',
    username: 'hacker',
    displayName: 'Hacker',
    role: 'user',
  });
  assert.equal(res.ok, false);
});

test('Dirty Dozen #8: Value Poisoning on bio (>500 chars) is rejected', () => {
  const res = validateFirestorePayload('publicProfiles', {
    uid: 'user_abc',
    username: 'valid_user',
    displayName: 'Valid User',
    role: 'user',
    bio: 'x'.repeat(501),
  });
  assert.equal(res.ok, false);
});

test('Dirty Dozen #9: Terminal state bypass on feedback create is rejected', () => {
  const res = validateFirestorePayload('feedback', {
    status: 'resolved',
  });
  assert.equal(res.ok, false);
});

test('Dirty Dozen #11: Self-follow loop is rejected', () => {
  const res = validateFirestorePayload('follows', {
    followerId: 'user_1',
    followingId: 'user_1',
  });
  assert.equal(res.ok, false);
});

test('Deployed firestore.rules contains default-deny, email_verified guard, and zero blanket reads', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.doesNotMatch(rules, /allow list:\s*if isSignedIn\(\);/);
  assert.doesNotMatch(rules, /allow read:\s*if true;/);
});

test('Avatar upload validation accepts compressed image data URLs and rejects invalid schemes', () => {
  const ok = validateFirestorePayload('publicProfiles', {
    uid: 'user_abc',
    username: 'valid_user',
    displayName: 'Valid User',
    role: 'user',
    avatarUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4',
  });
  assert.equal(ok.ok, true);

  const bad = validateFirestorePayload('publicProfiles', {
    uid: 'user_abc',
    username: 'valid_user',
    displayName: 'Valid User',
    role: 'user',
    avatarUrl: 'javascript:alert(1)',
  });
  assert.equal(bad.ok, false);
});

test('PrivateUser validates themePreference values', () => {
  const ok = validateFirestorePayload('privateUsers', {
    uid: 'user_abc',
    email: 'user@example.com',
    fullName: 'Valid User',
    themePreference: 'light',
  });
  assert.equal(ok.ok, true);

  const bad = validateFirestorePayload('privateUsers', {
    uid: 'user_abc',
    email: 'user@example.com',
    fullName: 'Valid User',
    themePreference: 'neon-invalid',
  });
  assert.equal(bad.ok, false);
});

test('Downloads collection enforces strict schema and owner isolation in firestore.rules', () => {
  const ok = validateFirestorePayload('downloads', {
    id: 'dl_user_1_anim_1',
    userId: 'user_1',
    videoId: 'anim-dimensional-rift-loop',
    title: 'Dimensional Iris Portal Sequence',
    format: 'MP4',
    fileSizeBytes: 512000,
    downloadedBytes: 512000,
    status: 'completed',
  });
  assert.equal(ok.ok, true);

  const badShadow = validateFirestorePayload('downloads', {
    id: 'dl_user_1_anim_1',
    userId: 'user_1',
    videoId: 'anim-dimensional-rift-loop',
    title: 'Test',
    format: 'MP4',
    fileSizeBytes: 100,
    downloadedBytes: 100,
    status: 'completed',
    isAdminOverride: true,
  });
  assert.equal(badShadow.ok, false);

  const rules = fs.readFileSync('firestore.rules', 'utf8');
  assert.match(rules, /match \/downloads\/\{downloadId\}/);
  assert.match(rules, /existing\(\)\.userId == request\.auth\.uid/);
  assert.match(rules, /function isValidDownload\(data\)/);
});
