import { fieldsCookie, storedFields } from './fields-cookie.ts';
import {
  fetchBackend,
  modelProxyConfig,
  resolveLibraryId,
} from './hi-server.ts';
import { planningAssistantConfig, type Provider } from './model-config.ts';
import { startPlanner, type PlannerSettings } from './planner.ts';
import { plannerQueryOptions } from './query-options.ts';

const signInView = document.querySelector<HTMLElement>('#sign-in-view')!;
const plannerView = document.querySelector<HTMLElement>('#planner')!;
const form = document.querySelector<HTMLFormElement>('#sign-in')!;
const submitButton = form.querySelector<HTMLButtonElement>('button')!;
const errorMessage = form.querySelector<HTMLElement>('.error')!;
const cookieConsent =
  document.querySelector<HTMLDialogElement>('#cookie-consent')!;

const prefill = (entries: Iterable<[string, string]>) => {
  for (const [name, value] of entries) {
    const field = form.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      field.value = value;
    }
  }
};

prefill(storedFields(document.cookie));
prefill(new URLSearchParams(location.search));

const askCookieConsent = () =>
  new Promise<boolean>((resolve) => {
    cookieConsent.returnValue = '';
    cookieConsent.addEventListener(
      'close',
      () => resolve(cookieConsent.returnValue === 'allow'),
      { once: true }
    );
    cookieConsent.showModal();
  });

const readSettings = async (fields: FormData): Promise<PlannerSettings> => {
  const value = (name: string) => String(fields.get(name) ?? '').trim();
  const provider = value('provider') as Provider | '';
  const model = value('model');
  const apiKey = value('apiKey');
  const chat =
    provider || model || apiKey
      ? planningAssistantConfig(provider, model, apiKey)
      : undefined;
  const authorization = `Basic ${btoa(`${value('user')}:${fields.get('password')}`)}`;
  const { backend, modelProxy } = await fetchBackend(
    authorization,
    value('backendId')
  );
  return {
    authorization,
    backend,
    libraryId: resolveLibraryId(value('libraryId'), backend),
    chat: chat ?? (modelProxy ? modelProxyConfig(authorization) : undefined),
    queryOptions: plannerQueryOptions(location.search, [...fields.keys()]),
  };
};

const showPlanner = (shown: boolean) => {
  signInView.hidden = shown;
  plannerView.hidden = !shown;
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  errorMessage.textContent = '';
  try {
    const fields = new FormData(form);
    const settings = await readSettings(fields);
    if (
      storedFields(document.cookie).length > 0 ||
      (await askCookieConsent())
    ) {
      document.cookie = fieldsCookie(fields);
    }
    showPlanner(true);
    await startPlanner(plannerView, settings);
  } catch (error) {
    plannerView.replaceChildren();
    showPlanner(false);
    errorMessage.textContent =
      error instanceof Error ? error.message : String(error);
  } finally {
    submitButton.disabled = false;
  }
});
