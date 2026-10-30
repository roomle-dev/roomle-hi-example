import { fetchBackend } from './hi-server.ts';
import { planningAssistantConfig } from './model-config.ts';
import { startPlanner, type PlannerSettings } from './planner.ts';

const signInView = document.querySelector<HTMLElement>('#sign-in-view')!;
const plannerView = document.querySelector<HTMLElement>('#planner')!;
const form = document.querySelector<HTMLFormElement>('#sign-in')!;
const submitButton = form.querySelector<HTMLButtonElement>('button')!;
const errorMessage = form.querySelector<HTMLElement>('.error')!;

const readSettings = async (fields: FormData): Promise<PlannerSettings> => {
  const value = (name: string) => String(fields.get(name) ?? '').trim();
  const model = value('model');
  const apiKey = value('apiKey');
  const chat =
    model || apiKey ? planningAssistantConfig(model, apiKey) : undefined;
  const authorization = `Basic ${btoa(`${value('user')}:${fields.get('password')}`)}`;
  const backend = await fetchBackend(authorization, value('backendId'));
  return { authorization, backend, libraryId: value('libraryId'), chat };
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
    const settings = await readSettings(new FormData(form));
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
