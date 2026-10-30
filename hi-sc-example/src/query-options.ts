export type QueryOptions = Record<string, string | number | boolean>;

const queryValue = (value: string) => {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  return value.trim() !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : value;
};

/**
 * The planner options of the query parameters in `search` other than the
 * `loginFields`, converted as the Roomle SDK converts its URL parameters:
 * `true`, `false` and numbers to their types. A `language` also sets the
 * `locale`.
 */
export const plannerQueryOptions = (
  search: string,
  loginFields: string[]
): QueryOptions => {
  const options: QueryOptions = Object.fromEntries(
    [...new URLSearchParams(search)]
      .filter(([name]) => !loginFields.includes(name))
      .map(([name, value]) => [name, queryValue(value)])
  );
  if (options.language !== undefined) {
    options.locale = options.language;
  }
  return options;
};
