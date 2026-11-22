import assert from 'node:assert/strict';
import test from 'node:test';
import { PERMISSIONS, ROLES, roleHasPermission } from '../src/domain/identity/Rbac.ts';

/**
 * News is rendered on the public landing page, so publishing it is a moderated
 * action. These tests pin the permission matrix that the application layer
 * enforces in CreatePostUseCase / UpdatePostUseCase — a regression here would
 * let a candidate put arbitrary text on the front page.
 */

test('news publishing requires moderator capability, not just publish rights', () => {
  for (const role of [ROLES.CANDIDATE, ROLES.INSTRUCTOR]) {
    // They may write in the community feed…
    assert.equal(
      roleHasPermission(role, PERMISSIONS.PUBLISH_POST),
      true,
      `${role} should be able to post updates`
    );
    // …but not curate the public landing page.
    assert.equal(
      roleHasPermission(role, PERMISSIONS.MODERATE_CONTENT),
      false,
      `${role} must not be able to publish news`
    );
  }
});

test('curators and admins may publish news', () => {
  for (const role of [ROLES.CURATOR, ROLES.ADMIN]) {
    assert.equal(roleHasPermission(role, PERMISSIONS.MODERATE_CONTENT), true);
    assert.equal(roleHasPermission(role, PERMISSIONS.PUBLISH_POST), true);
  }
});

test('the gate is MODERATE_CONTENT, which only curation roles hold', () => {
  const holders = [ROLES.CANDIDATE, ROLES.INSTRUCTOR, ROLES.CURATOR, ROLES.ADMIN].filter(
    (role) => roleHasPermission(role, PERMISSIONS.MODERATE_CONTENT)
  );
  assert.deepEqual(holders, [ROLES.CURATOR, ROLES.ADMIN]);
});
