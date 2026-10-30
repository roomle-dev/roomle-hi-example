import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plannerQueryOptions } from '../src/query-options.ts';

const LOGIN_FIELDS = ['user', 'password', 'backendId', 'libraryId'];

describe('plannerQueryOptions', () => {
  it('forwards every query parameter but the login fields', () => {
    assert.deepEqual(
      plannerQueryOptions(
        '?user=u&password=p&backendId=b&libraryId=l&id=ps_abc&overrideServerUrl=http%3A%2F%2Flocalhost%3A5173%2F&customApiUrl=https%3A%2F%2Fwww.roomle.com%2Fapi%2Fv2',
        LOGIN_FIELDS
      ),
      {
        id: 'ps_abc',
        overrideServerUrl: 'http://localhost:5173/',
        customApiUrl: 'https://www.roomle.com/api/v2',
      }
    );
  });

  it('converts true, false and numbers as the Roomle SDK does', () => {
    assert.deepEqual(
      plannerQueryOptions(
        '?moc=false&debugGeometry=true&envMapIntensity=1.25&unit=mm&empty=',
        []
      ),
      {
        moc: false,
        debugGeometry: true,
        envMapIntensity: 1.25,
        unit: 'mm',
        empty: '',
      }
    );
  });

  it('sets the locale to the language', () => {
    assert.deepEqual(plannerQueryOptions('?language=de-DE', []), {
      language: 'de-DE',
      locale: 'de-DE',
    });
  });

  it('forwards nothing without query parameters', () => {
    assert.deepEqual(plannerQueryOptions('', LOGIN_FIELDS), {});
  });
});
