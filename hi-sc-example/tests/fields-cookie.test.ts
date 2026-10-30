import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fieldsCookie, storedFields } from '../src/fields-cookie.ts';

const formData = (entries: [string, string][]) => {
  const fields = new FormData();
  for (const [name, value] of entries) {
    fields.append(name, value);
  }
  return fields;
};

describe('fieldsCookie and storedFields', () => {
  it('store the fields and read them back, with any characters', () => {
    const entries: [string, string][] = [
      ['user', 'tëst'],
      ['password', 'a;b=c %20 "d"'],
      ['provider', 'azure'],
      ['apiKey', ''],
    ];
    const cookie = fieldsCookie(formData(entries)).split('; ')[0];
    assert.deepEqual(storedFields(`other=1; ${cookie}; more=2`), entries);
  });

  it('keep the cookie a year for the whole page, same site only', () => {
    assert.match(
      fieldsCookie(formData([])),
      /^hi-sc-sign-in=.*; max-age=31536000; path=\/; SameSite=Strict$/
    );
  });

  it('read no fields without the cookie', () => {
    assert.deepEqual(storedFields(''), []);
    assert.deepEqual(storedFields('other=1; hi-sc-sign-in-other=2'), []);
  });
});
