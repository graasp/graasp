import { describe, expect, it } from 'vitest';

import { EMAIL_REGEX } from './member.schemas';

describe('Email regex', () => {
  it('Allows basic CH emails', () => {
    expect(new RegExp(EMAIL_REGEX).test('bob@tech.ch')).toBeTruthy();
    // with a dash in the name
    expect(new RegExp(EMAIL_REGEX).test('bob-helper@tech.ch')).toBeTruthy();
    // with a dot in the name
    expect(new RegExp(EMAIL_REGEX).test('bob.helper@tech.ch')).toBeTruthy();
    // with nested domains
    expect(new RegExp(EMAIL_REGEX).test('bob.helper@tech-team.ch')).toBeTruthy();
    // with dashes in the domain
    expect(new RegExp(EMAIL_REGEX).test('bob.helper@tech.team.ch')).toBeTruthy();
  });

  it('Allows longer domain names', () => {
    expect(new RegExp(EMAIL_REGEX).test('contact@paris.museum')).toBeTruthy();
    expect(new RegExp(EMAIL_REGEX).test('test@team.swiss')).toBeTruthy();
    expect(new RegExp(EMAIL_REGEX).test('test@team.swiss-hello')).toBeTruthy();
  });

  it('Does not allow non-emails', () => {
    expect(new RegExp(EMAIL_REGEX).test('bob')).toBeFalsy();
  });
});
