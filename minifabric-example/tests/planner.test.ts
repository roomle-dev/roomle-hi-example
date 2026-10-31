import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PLAN_ID, SERVER_URL } from '../../shared/src/hi-planner.ts';
import {
  PLANNING_ASSISTANT_CONFIG,
  orderManagerHeaders,
  plannerOptions,
} from '../src/planner.ts';
import { DEFAULT_SETTINGS } from '../src/settings.ts';

const PROXY =
  'https://europe-west3-rml-showcases.cloudfunctions.net/proxy_request';

describe('plannerOptions', () => {
  it('loads the nobilia library through the demo proxy without settings', () => {
    const options = plannerOptions(DEFAULT_SETTINGS, '');
    assert.equal(options.id, DEFAULT_PLAN_ID);
    assert.equal(options.overrideServerUrl, SERVER_URL);
    assert.equal(options.debugGeometry, false);
    assert.equal(options.locale, 'en-US,en');
    assert.equal(options.featureFlags.planningAssistant, true);
    assert.deepEqual(options.hi, {
      libraryId: 'nobilia_Minifabrik',
      serverOptions: {
        baseUrl: `${PROXY}?url=`,
        language: 'en-US,en',
        endpointUrl: 'https://connect.homag.com/',
        subscriptionId: '',
        key: '',
        om: {
          endpointUrl: 'https://connect.homag.com/',
          subscriptionId: '',
          key: '',
        },
      },
    });
    assert.deepEqual(options.externalObjectSettings.tecConfigInfo, {
      language: 'en-US,en',
      libraryId: 'nobilia_Minifabrik',
    });
    assert.equal(
      options.externalObjectSettings.uiConfiguration.userRight,
      'Simple'
    );
  });

  it('passes the settings to the library and the order manager', () => {
    const options = plannerOptions(
      {
        locale: 'de-DE,de',
        apiKey: 'k',
        libraryId: 'L',
        subscriptionId: 's',
        endpointUrl: 'https://e/',
        userRight: 'Master',
      },
      ''
    );
    assert.equal(options.locale, 'de-DE,de');
    assert.deepEqual(options.hi, {
      libraryId: 'L',
      serverOptions: {
        baseUrl: `${PROXY}?url=`,
        language: 'de-DE,de',
        endpointUrl: 'https://e/',
        subscriptionId: 's',
        key: 'k',
        om: { endpointUrl: 'https://e/', subscriptionId: 's', key: 'k' },
      },
    });
    assert.deepEqual(options.externalObjectSettings.tecConfigInfo, {
      language: 'de-DE,de',
      libraryId: 'L',
    });
    assert.equal(
      options.externalObjectSettings.uiConfiguration.userRight,
      'Master'
    );
  });

  it('takes the plan, the server and the debug geometry from the query', () => {
    const options = plannerOptions(
      DEFAULT_SETTINGS,
      '?plan_id=ps_x&server_url=http%3A%2F%2Flocalhost%3A5173%2F&debug=true'
    );
    assert.equal(options.id, 'ps_x');
    assert.equal(options.overrideServerUrl, 'http://localhost:5173/');
    assert.equal(options.debugGeometry, true);
  });
});

describe('orderManagerHeaders', () => {
  it('names nobilia for a nobilia library only', () => {
    assert.deepEqual(orderManagerHeaders('nobilia_Minifabrik'), {
      'x-aux-header': 'nobilia',
    });
    assert.deepEqual(orderManagerHeaders('Furniture_Smith'), {
      'x-aux-header': 'none',
    });
  });
});

describe('PLANNING_ASSISTANT_CONFIG', () => {
  it('runs the chat on the Azure AI route of the demo proxy', () => {
    assert.equal(PLANNING_ASSISTANT_CONFIG.provider, 'azure');
    assert.equal(PLANNING_ASSISTANT_CONFIG.baseUrl, `${PROXY}/azure-ai`);
    assert.equal(PLANNING_ASSISTANT_CONFIG.model, 'gpt-6-astra');
  });
});
