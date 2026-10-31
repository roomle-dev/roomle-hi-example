import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_SETTINGS,
  applyQueryParams,
  loadSettings,
  saveSettings,
} from '../src/settings.ts';

const storage = (entries: Record<string, string> = {}) => ({
  getItem: (key: string) => entries[key] ?? null,
  setItem: (key: string, value: string) => {
    entries[key] = value;
  },
});

describe('loadSettings', () => {
  it('takes the defaults without stored settings', () => {
    assert.deepEqual(loadSettings(storage()), DEFAULT_SETTINGS);
  });

  it('takes the stored settings over the defaults', () => {
    const entries = storage();
    saveSettings(entries, { ...DEFAULT_SETTINGS, apiKey: 'k' });
    assert.deepEqual(loadSettings(entries), {
      ...DEFAULT_SETTINGS,
      apiKey: 'k',
    });
    assert.deepEqual(
      loadSettings(
        storage({ 'nobilia-demo-settings': JSON.stringify({ libraryId: 'L' }) })
      ),
      { ...DEFAULT_SETTINGS, libraryId: 'L' }
    );
  });

  it('keeps the defaults for an invalid entry or an unreadable storage', () => {
    assert.deepEqual(
      loadSettings(storage({ 'nobilia-demo-settings': '{' })),
      DEFAULT_SETTINGS
    );
    assert.deepEqual(
      loadSettings({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
      DEFAULT_SETTINGS
    );
  });
});

describe('applyQueryParams', () => {
  it('takes every setting from its query parameter', () => {
    assert.deepEqual(
      applyQueryParams(
        DEFAULT_SETTINGS,
        '?locale=de-DE,de&apiKey=k&libraryId=L&subscriptionId=s&endpointUrl=https%3A%2F%2Fe%2F&user_right=Master'
      ),
      {
        locale: 'de-DE,de',
        apiKey: 'k',
        libraryId: 'L',
        subscriptionId: 's',
        endpointUrl: 'https://e/',
        userRight: 'Master',
      }
    );
  });

  it('takes language and library_id as the aliases', () => {
    assert.deepEqual(
      applyQueryParams(DEFAULT_SETTINGS, '?language=de-DE,de&library_id=L'),
      { ...DEFAULT_SETTINGS, locale: 'de-DE,de', libraryId: 'L' }
    );
    assert.deepEqual(
      applyQueryParams(
        DEFAULT_SETTINGS,
        '?locale=en-US,en&language=de-DE,de&libraryId=A&library_id=B'
      ),
      { ...DEFAULT_SETTINGS, locale: 'en-US,en', libraryId: 'A' }
    );
  });

  it('keeps the settings without their query parameters or for an unknown parameter level', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'k',
      userRight: 'Advanced' as const,
    };
    assert.deepEqual(applyQueryParams(settings, ''), settings);
    assert.deepEqual(applyQueryParams(settings, '?user_right=Admin'), settings);
  });
});
